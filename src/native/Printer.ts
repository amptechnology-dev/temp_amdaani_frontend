import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ensureBluetoothPermission } from '../utils/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { PrinterModule } = NativeModules;
const emitter = new NativeEventEmitter(PrinterModule);

/* -------------------------------------------------------------------------- */
/*                           Bluetooth Permission API                          */
/* -------------------------------------------------------------------------- */
export async function ensureBtPermissions(): Promise<boolean> {
  try {
    const granted = await ensureBluetoothPermission();
    if (!granted) {
      Toast.show({
        type: 'error',
        text1: 'Bluetooth permission denied',
        text2: 'Please allow Bluetooth access in Settings to connect to printers.',
      });
    }
    return granted;
  } catch (error) {
    console.error('ensureBtPermissions error:', error);
    Toast.show({
      type: 'error',
      text1: 'Bluetooth permission error',
      text2: 'Unable to check or request Bluetooth permission.',
    });
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Printer API Wrapper                            */
/* -------------------------------------------------------------------------- */
export const Printer = {
  /* ---------------------------- Bluetooth Basics ---------------------------- */
  async isBluetoothAvailable(): Promise<boolean> {
    try {
      if (PrinterModule.getBluetoothState) {
        const state = await PrinterModule.getBluetoothState();
        return state === 'ON';
      }
      return await PrinterModule.isBluetoothAvailable();
    } catch (err) {
      console.error('isBluetoothAvailable error:', err);
      return false;
    }
  },

  async requestEnable(): Promise<boolean> {
    try {
      if (PrinterModule.requestEnable) {
        await PrinterModule.requestEnable();
        return true;
      }
      // fallback: open settings if module doesn't support requestEnable
      if (Platform.OS === 'android') await Linking.openSettings();
      return false;
    } catch (err) {
      console.error('requestEnable error:', err);
      return false;
    }
  },

  async getPairedDevices(): Promise<Array<{ name: string; address: string }>> {
    try {
      const ok = await ensureBtPermissions();
      if (!ok) return [];
      return await PrinterModule.getPairedDevices();
    } catch (err) {
      console.error('getPairedDevices error:', err);
      return [];
    }
  },

  async ensureConnected(): Promise<boolean> {
    try {
      const connected = await PrinterModule.isConnected();
      if (connected) {
        // console.log("✅ Printer verified connected");
        return true;
      }

      // console.log("⚠️ Printer disconnected — attempting auto reconnect...");

      // Try saved printer first
      const saved = await AsyncStorage.getItem("selectedPrinter");
      if (saved) {
        const dev = JSON.parse(saved);
        try {
          const ok = await PrinterModule.connect(dev.address);
          if (ok) {
            // console.log("✅ Reconnected to saved printer");
            return true;
          }
        } catch (e) {
          console.warn("❌ Failed to reconnect saved printer", e);
        }
      }

      // Try paired printer as fallback
      try {
        const ok = await PrinterModule.connectPairedPrinter();
        if (ok) {
          // console.log("✅ Connected to paired printer");
          return true;
        }
      } catch (e) {
        console.warn("❌ Failed to connect paired printer", e);
      }

      console.warn("❌ Printer connection failed");
      return false;
    } catch (err) {
      console.error("ensureConnected error:", err);
      return false;
    }
  },

  async autoReconnectOnStartup(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem("selectedPrinter");
      if (!saved) {
        // console.log("ℹ️ No saved printer for auto reconnect");
        return;
      }

      const dev = JSON.parse(saved);
      const connected = await PrinterModule.isConnected();
      if (!connected) {
        // console.log("🔄 Auto reconnecting to saved printer:", dev.name || dev.address);
        try {
          const ok = await PrinterModule.connect(dev.address);
          if (ok) {
            // console.log("✅ Auto-reconnected to printer:", dev.name);
          } else {
            console.warn("⚠️ Auto-reconnect attempt failed");
          }
        } catch (e) {
          console.warn("❌ Auto-reconnect error:", e);
        }
      } else {
        // console.log("✅ Printer already connected at startup");
      }
    } catch (e) {
      console.error("Auto reconnect startup error:", e);
    }
  },

  /* ------------------------------- Scan & Connect ------------------------------- */
  async scan(): Promise<Array<{ name: string; address: string }>> {
    try {
      const ok = await ensureBtPermissions();
      if (!ok) return [];

      const isOn = await this.isBluetoothAvailable();
      if (!isOn) {
        Toast.show({
          type: 'info',
          text1: 'Bluetooth is turned off',
          text2: 'Please enable Bluetooth to scan for printers.',
        });
        await this.requestEnable();
        return [];
      }

      const devices = await PrinterModule.scan();
      return devices || [];
    } catch (err) {
      console.error('scan error:', err);
      Toast.show({
        type: 'error',
        text1: 'Scan failed',
        text2: 'Unable to start Bluetooth discovery.',
      });
      return [];
    }
  },

  async cancelScan(): Promise<void> {
    try {
      if (PrinterModule.cancelScan) await PrinterModule.cancelScan();
    } catch (err) {
      console.warn('cancelScan error:', err);
    }
  },

  async connect(address: string): Promise<boolean> {
    try {
      if (!address) {
        Toast.show({ type: 'error', text1: 'Invalid printer address' });
        return false;
      }

      const ok = await ensureBtPermissions();
      if (!ok) return false;

      const connected = await PrinterModule.connect(address);
      return !!connected;
    } catch (err) {
      console.error('connect error:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to connect printer',
        text2: 'Ensure your printer is on and within range.',
      });
      return false;
    }
  },

  async disconnect(): Promise<boolean> {
    try {
      const res = await PrinterModule.disconnect();
      return !!res;
    } catch (err) {
      console.warn('disconnect error:', err);
      return false;
    }
  },

  async isConnected(): Promise<boolean> {
    try {
      const connected = await PrinterModule.isConnected();
      return !!connected;
    } catch {
      return false;
    }
  },

  /* ------------------------------- Print Methods ------------------------------- */

  printText: (
    text: string,
    options?: {
      align?: 'left' | 'center' | 'right';
      bold?: boolean;
      sizeW?: number;
      sizeH?: number;
      font?: 'a' | 'b';
    }
  ) => PrinterModule.printText(text, options || null),

  printColumns: (
    widths: number[],
    aligns: ('left' | 'center' | 'right')[],
    texts: string[],
    options?: {
      bold?: boolean;
      sizeW?: number;
      sizeH?: number;
      font?: 'a' | 'b';
    }
  ) => PrinterModule.printColumns(widths, aligns, texts, options || null),

  printQRCode: (data: string, size = 6) =>
    PrinterModule.printQRCode(data, size),

  printImageBase64: (
    b64: string,
    targetWidthPx = 384,
    mode: 'bayer' | 'floyd' | 'threshold' = 'floyd',
    align: 'left' | 'center' | 'right' = 'center'
  ) => PrinterModule.printImageBase64(b64, targetWidthPx, mode, align),

  feed: (lines = 2) => PrinterModule.feed(lines),
  cut: () => PrinterModule.cut(),
  openCashDrawer: () => PrinterModule.openCashDrawer(),

  /* ---------------------------- Bluetooth Events ---------------------------- */
  addListener(event: string, callback: (...args: any[]) => void) {
    return emitter.addListener(event, callback);
  },

  removeAllListeners(event: string) {
    emitter.removeAllListeners(event);
  },
};

/* -------------------------------------------------------------------------- */
/*                        Helper: Auto-enable Bluetooth                       */
/* -------------------------------------------------------------------------- */
/**
 * Ensures Bluetooth is ON and permissions are granted before scanning or printing.
 * Returns `true` if Bluetooth is available and ready to use.
 */
export async function ensureBluetoothReady(): Promise<boolean> {
  const ok = await ensureBtPermissions();
  if (!ok) return false;

  const isOn = await Printer.isBluetoothAvailable();
  if (!isOn) {
    Toast.show({
      type: 'info',
      text1: 'Bluetooth is off',
      text2: 'Please enable Bluetooth to connect to printers.',
    });
    await Printer.requestEnable();
    return false;
  }
  return true;
}
