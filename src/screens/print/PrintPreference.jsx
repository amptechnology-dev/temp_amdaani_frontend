import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  NativeEventEmitter,
  NativeModules,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Text, Button, useTheme, Card, IconButton } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Printer, ensureBtPermissions } from "../../native/Printer";
import { ensureLocationEnabled } from "../../utils/permissions";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import Navbar from "../../components/Navbar";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomAlert from "../../components/CustomAlert";

const eventEmitter = new NativeEventEmitter(NativeModules.PrinterModule);

export default function PrintPreference() {
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState(null);

  const [savedPrinter, setSavedPrinter] = useState(null);
  const [connectedPrinter, setConnectedPrinter] = useState(null);
  const [connectingAddr, setConnectingAddr] = useState(null);
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [userRefreshing, setUserRefreshing] = useState(false);

  const nav = useNavigation();
  const route = useRoute();
  const theme = useTheme();

  // refs for safety across async callbacks
  const isMounted = useRef(true);
  const scanTimeoutRef = useRef(null);
  const connectedAddrRef = useRef(null);
  const devicesRef = useRef([]);

  // event listeners refs to remove on unmount
  const foundListenerRef = useRef(null);
  const finishListenerRef = useRef(null);
  const btStateListenerRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      if (mode === "thermal" && !scanning) {
        performThermalScan();
      }
    }, [mode]) // intentionally not including performThermalScan to keep stable reference
  );


  useFocusEffect(
    useCallback(() => {
      const checkConnection = async () => {
        try {
          const isConn = await Printer.isConnected();
          if (!isConn) {
            // console.log("🔄 Printer disconnected — trying auto reconnect");
            const ok = await Printer.ensureConnected();
            if (!ok) {
              Toast.show({
                type: "error",
                text1: "Printer disconnected",
                text2: "Please reconnect your printer",
              });
            } else {
              const saved = await AsyncStorage.getItem("selectedPrinter");
              if (saved) {
                const parsed = JSON.parse(saved);
                setConnectedPrinter(parsed);
                Toast.show({ type: "success", text1: "Printer reconnected" });
              }
            }
          }
        } catch (e) {
          console.warn("Connection check failed", e);
        }
      };
      checkConnection();
    }, [])
  );



  // keep a ref in sync with latest devices so async callbacks can read it
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    isMounted.current = true;
    // listen for devices and scan-finished events emitted by native module
    foundListenerRef.current = eventEmitter.addListener("PrinterFound", (dev) => {
      if (!isMounted.current) return;
      setDevices((prev) => {
        if (prev.find((d) => d.address === dev.address)) return prev;
        return [...prev, dev];
      });
    });

    finishListenerRef.current = eventEmitter.addListener("ScanFinished", () => {
      if (!isMounted.current) return;
      setScanning(false);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      // if scan finished but no devices found, prompt user to check Location (Android < 13 requires location for discovery)
      try {
        const api = Platform.Version;
        if (Platform.OS === "android" && api < 33 && devicesRef.current?.length === 0) {
          showAlert({
            title: "Enable Location",
            message: "Turn on device Location to discover nearby Bluetooth printers.",
            type: "warning",
            actions: [
              { label: "Cancel", onPress: hideAlert },
              {
                label: "Open Settings",
                mode: "contained",
                onPress: async () => {
                  hideAlert();
                  try {
                    await Linking.openSettings();
                  } finally {
                    setTimeout(async () => {
                      const ok2 = await ensureLocationEnabled();
                      if (ok2) performThermalScan();
                    }, 800);
                  }
                },
              },
            ],
          });

        }
      } catch (e) {
        // ignore errors
      }
    });

    // optional: if native emits bluetooth state changes
    btStateListenerRef.current = eventEmitter.addListener("BluetoothStateChanged", (st) => {
      // native should send { state: "ON" | "OFF" | "TURNING_ON" | "TURNING_OFF" }
      if (!isMounted.current) return;
      const on = st?.state === "ON";
      setBluetoothOn(on);
      if (!on && scanning) {
        // stop UI scanning if BT turned off
        setScanning(false);
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        Toast.show({ type: "error", text1: "Bluetooth turned off — scan stopped" });
      }
    });

    // check current bluetooth availability
    (async () => {
      try {
        const available = await Printer.isBluetoothAvailable();
        setBluetoothOn(!!available);
      } catch (e) {
        setBluetoothOn(false);
      }
    })();

    return () => {
      // cleanup
      isMounted.current = false;
      foundListenerRef.current?.remove();
      finishListenerRef.current?.remove();
      btStateListenerRef.current?.remove();
      // ensure native discovery cancelled if any
      try {
        Printer.cancelScan && Printer.cancelScan();
      } catch { }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  // load saved prefs
  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem("printMode");
        if (savedMode) setMode(savedMode);

        const saved = await AsyncStorage.getItem("selectedPrinter");
        if (saved) {
          const parsed = JSON.parse(saved);
          setSavedPrinter(parsed);
          // set connected visually if device currently connected according to native
          const isConn = await Printer.isConnected();
          if (isConn) {
            setConnectedPrinter(parsed);
            connectedAddrRef.current = parsed.address;
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // auto-start scan when focus and thermal mode

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info", // "info" | "success" | "warning" | "error"
    actions: [],  // [{ label, onPress, mode?, color? }]
  });

  // helper to open the alert
  const showAlert = useCallback((cfg) => {
    setCustomAlert({
      visible: true,
      title: cfg.title || "",
      message: cfg.message || "",
      type: cfg.type || "info",
      actions: Array.isArray(cfg.actions) && cfg.actions.length
        ? cfg.actions
        : [{ label: "OK", onPress: () => setCustomAlert((s) => ({ ...s, visible: false })) }],
    });
  }, []);

  const hideAlert = useCallback(() => {
    setCustomAlert((s) => ({ ...s, visible: false }));
  }, []);

  const stopScan = useCallback(() => {
    try {
      Printer.cancelScan && Printer.cancelScan();
    } catch { }
    setScanning(false);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  const performThermalScan = useCallback(async () => {
    if (scanning) return; // prevent double scan
    // permissions
    const ok = await ensureBtPermissions();
    if (!ok) {
      Toast.show({ type: "error", text1: "Bluetooth permission not granted" });
      return;
    }

    // For Android < 13, Location permission and (system) Location turned on might be required for discovery
    if (Platform.OS === "android" && Platform.Version < 33) {
      const locOk = await ensureLocationEnabled();
      if (!locOk) {
        showAlert({
          title: "Enable Location",
          message: "Turn on device Location to discover nearby Bluetooth printers.",
          type: "warning",
          actions: [
            { label: "Cancel", onPress: hideAlert },
            {
              label: "Open Settings",
              mode: "contained",
              onPress: async () => {
                hideAlert();
                try {
                  await Linking.openSettings();
                } finally {
                  setTimeout(async () => {
                    const ok2 = await ensureLocationEnabled();
                    if (ok2) performThermalScan();
                  }, 800);
                }
              },
            },
          ],
        });

        return;
      }
    }

    // is bluetooth on?
    try {
      const available = await Printer.isBluetoothAvailable();
      if (!available) {
        setBluetoothOn(false);
        // attempt to request enabling
        showAlert({
          title: "Bluetooth is off",
          message: "Please enable Bluetooth to scan for printers.",
          type: "warning",
          actions: [
            {
              label: "Enable",
              mode: "contained",
              onPress: async () => {
                hideAlert();
                try {
                  if (Printer.requestEnable) {
                    await Printer.requestEnable();
                  } else if (Platform.OS === "android") {
                    Linking.openSettings();
                  }
                } catch {
                  Toast.show({ type: "error", text1: "Cannot enable Bluetooth from app" });
                }
              },
            },
            { label: "Cancel", onPress: hideAlert },
          ],
        });

        return;
      }
    } catch (e) {
      // assume off
      setBluetoothOn(false);
      Toast.show({ type: "error", text1: "Bluetooth not available" });
      return;
    }

    // start scan
    setDevices([]);
    setScanning(true);

    try {
      // ensure native discovery canceled before starting
      try {
        Printer.cancelScan && Printer.cancelScan();
      } catch { }

      const okStart = await Printer.scan(); // native emits PrinterFound events and ScanFinished
      if (!okStart) {
        // unlikely, but treat as failure
        throw new Error("Native scan failed");
      }

      // safety timeout in case native never fires finished
      scanTimeoutRef.current = setTimeout(() => {
        if (!isMounted.current) return;
        setScanning(false);
        scanTimeoutRef.current = null;
        // Toast.show({ type: "info", text1: "Scan timed out" });
        try {
          Printer.cancelScan && Printer.cancelScan();
        } catch { }
        // if timeout reached with no devices found, suggest checking Location on older Android
        try {
          const api = Platform.Version;
          if (Platform.OS === "android" && api < 33 && devicesRef.current?.length === 0) {
            showAlert({
              title: "No devices found",
              message: "No nearby Bluetooth printers were discovered. Make sure device Location is turned on and the app has Location permission.",
              type: "warning",
              actions: [
                { label: "Cancel", onPress: hideAlert },
                {
                  label: "Open Settings",
                  mode: "contained",
                  onPress: async () => {
                    hideAlert();
                    try {
                      const ok = await ensureLocationEnabled();
                      if (!ok) Linking.openSettings();
                    } catch {
                      Linking.openSettings();
                    }
                  },
                },
              ],
            });

          }
        } catch (e) { }
      }, 12_000); // 12s timeout
    } catch (e) {
      setScanning(false);
      Toast.show({ type: "error", text1: "Failed to start scan" });
    }
  }, [scanning]);

  const tryConnectWithRetries = useCallback(
    async (dev, maxRetries = 3) => {
      let attempts = 0;
      setConnectingAddr(dev.address);
      // ensure discovery is canceled (discovery can prevent connect on some devices)
      try {
        Printer.cancelScan && Printer.cancelScan();
      } catch { }

      while (attempts < maxRetries) {
        attempts++;
        try {
          // Protect connect with a timeout
          const connectPromise = Printer.connect(dev.address);
          const result = await promiseWithTimeout(connectPromise, 12_000); // 12s connect timeout
          if (result === true) {
            // success
            setConnectedPrinter(dev);
            connectedAddrRef.current = dev.address;
            await AsyncStorage.setItem("selectedPrinter", JSON.stringify(dev));
            Toast.show({ type: "success", text1: "Printer connected" });
            setConnectingAddr(null);
            return true;
          } else {
            throw new Error("Connect failed");
          }
        } catch (e) {
          // try again unless last attempt
          if (attempts >= maxRetries) {
            Toast.show({ type: "error", text1: "Failed to connect to printer" });
            setConnectingAddr(null);
            return false;
          } else {
            // small backoff
            await sleep(700 * attempts);
          }
        }
      }
      setConnectingAddr(null);
      return false;
    },
    []
  );

  const connect = useCallback(async (dev) => {
    try {
      await tryConnectWithRetries(dev, 3);
    } catch (e) {
      Toast.show({ type: "error", text1: "Connection error" });
      setConnectingAddr(null);
    }
  }, []);

  const listData = useMemo(() => {
    if (!connectedPrinter) return devices;
    const rest = devices.filter((d) => d.address !== connectedPrinter.address);
    return [connectedPrinter, ...rest];
  }, [devices, connectedPrinter]);

  const handleSave = async () => {
    if (!mode) {
      Toast.show({ type: "error", text1: "Please select a print mode" });
      return;
    }

    await AsyncStorage.setItem("printMode", mode);

    if (mode === "a4") {
      await AsyncStorage.removeItem("selectedPrinter");
      route.params?.onPrinterSelected?.({ mode: "a4" });
    } else {
      const payload = connectedPrinter
        ? { mode: "thermal", selectedPrinter: connectedPrinter }
        : { mode: "thermal" };

      if (connectedPrinter) {
        await AsyncStorage.setItem(
          "selectedPrinter",
          JSON.stringify(connectedPrinter)
        );
      }
      route.params?.onPrinterSelected?.(payload);
    }

    nav.pop();
  };

  const onUserRefresh = useCallback(async () => {
    setUserRefreshing(true);
    await performThermalScan();
    setUserRefreshing(false);
  }, [performThermalScan]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Navbar title={"Print Preference"} showBackButton />

      {/* Mode selection */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <Button
          mode={mode === "a4" ? "contained" : "outlined"}
          onPress={() => setMode("a4")}
          accessibilityLabel="Select A4"
        >
          A4 Invoice
        </Button>

        <Button
          mode={mode === "thermal" ? "contained" : "outlined"}
          onPress={() => setMode("thermal")}
          accessibilityLabel="Select Thermal"
        >
          Thermal Print
        </Button>
      </View>

      {/* Thermal printers */}
      {mode === "thermal" && (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text variant="titleMedium" style={{ flex: 1 }}>
              Available Thermal Printers
            </Text>

            {scanning ? (
              <ActivityIndicator size="small" />
            ) : (
              <IconButton
                icon="refresh"
                size={22}
                onPress={() => performThermalScan()}
                accessibilityLabel="Rescan printers"
                disabled={scanning}
              />
            )}
          </View>

          <FlatList
            data={listData}
            extraData={connectingAddr}
            keyExtractor={(item) => item.address}
            renderItem={({ item }) => {
              const isConnected = connectedPrinter?.address === item.address;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isConnected) {
                      // already connected - toggle disconnect
                      showAlert({
                        title: "Disconnect",
                        message: `Disconnect from ${item.name || "printer"}?`,
                        type: "warning",
                        actions: [
                          { label: "Cancel", onPress: hideAlert },
                          {
                            label: "Disconnect",
                            mode: "contained",
                            color: "#ef4444",
                            onPress: async () => {
                              hideAlert();
                              try {
                                await Printer.disconnect();
                                setConnectedPrinter(null);
                                connectedAddrRef.current = null;
                                await AsyncStorage.removeItem("selectedPrinter");
                                Toast.show({ type: "info", text1: "Printer disconnected" });
                              } catch {
                                Toast.show({ type: "error", text1: "Failed to disconnect" });
                              }
                            },
                          },
                        ],
                      });

                      return;
                    }
                    // otherwise attempt connect
                    connect(item);
                  }}
                  accessibilityRole="button"
                  key={item.address}
                >
                  <Card
                    style={{
                      marginBottom: 10,
                      borderRadius: 12,
                      borderWidth: isConnected ? 1.5 : 0,
                      borderColor: isConnected ? theme.colors.primary : "transparent",
                    }}
                  >
                    <Card.Content
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="bodyLarge"
                          style={{
                            fontWeight: isConnected ? "700" : "500",
                            color: theme.colors.onSurface,
                          }}
                        >
                          {item.name || "Unknown"}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.outlineVariant }}
                        >
                          {item.address}
                        </Text>
                      </View>
                      {connectingAddr === item.address ? (
                        <ActivityIndicator size="small" />
                      ) : isConnected ? (
                        <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
                          ✓ Connected
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: theme.colors.secondary }}>
                          Tap to connect
                        </Text>
                      )}
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={{ color: "gray", textAlign: "center", marginTop: 20 }}>
                {scanning ? "Searching nearby devices…" : "No devices found"}
              </Text>
            }
            refreshControl={
              <RefreshControl refreshing={userRefreshing} onRefresh={onUserRefresh} />
            }
          />
        </View>
      )}

      {/* Footer */}
      <View style={{ padding: 16 }}>
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!mode}
          style={{ borderRadius: 12 }}
          labelStyle={!mode ? { color: theme.colors.onBackground } : undefined}
        >
          Save
        </Button>
      </View>
      <CustomAlert
        visible={customAlert.visible}
        onDismiss={hideAlert}
        title={customAlert.title}
        message={customAlert.message}
        type={customAlert.type}
        actions={customAlert.actions}
      />

    </SafeAreaView>
  );
}

// small helpers
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function promiseWithTimeout(promise, ms) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error("timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
