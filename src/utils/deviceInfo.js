import DeviceInfo from 'react-native-device-info';
import { NetworkInfo } from 'react-native-network-info';

export const getDeviceHeaders = async () => {
  const [ipAddress, deviceName] = await Promise.all([
    NetworkInfo.getIPAddress().catch(() => '0.0.0.0'),
    DeviceInfo.getDeviceName().catch(() => 'Unknown'),
  ]);

  const brand = DeviceInfo.getBrand(); // "Samsung"
  const model = DeviceInfo.getModel(); // "Galaxy S23"
  const osName = DeviceInfo.getSystemName(); // "Android"
  const osVersion = DeviceInfo.getSystemVersion(); // "14"

  // Mimics browser-style User-Agent
  const userAgent = `Mozilla/5.0 (Linux; ${osName} ${osVersion}; ${brand} ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Mobile`;

  return {
    'User-Agent': userAgent,
    'x-forwarded-for': ipAddress,
  };
};
