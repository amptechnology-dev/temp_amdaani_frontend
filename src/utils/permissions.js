// src/utils/permissions.js
import { Platform, Alert } from "react-native";
import { OneSignal } from "react-native-onesignal";
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  openSettings,
} from "react-native-permissions";
import Toast from "react-native-toast-message";
import { showPermissionAlert } from "../context/PermissionAlertProvider";

/**
 * === Global State ===
 */
let isAlertVisible = false;
const isGranted = (status) =>
  status === RESULTS.GRANTED || status === RESULTS.LIMITED;

/**
 * === Alert for Blocked Permissions ===
 */
const handleBlocked = (title, message) => {
  return new Promise((resolve) => {
    if (isAlertVisible) return resolve(false);
    isAlertVisible = true;

    showPermissionAlert({
      title,
      message,
      type: "warning",
      actions: [
        {
          label: "Cancel",
          mode: "outlined",
          onPress: () => {
            isAlertVisible = false;
            resolve(false);
          },
        },
        {
          label: "Open Settings",
          mode: "contained",
          onPress: async () => {
            try {
              await openSettings();
            } catch (err) {
              console.error("Failed to open settings:", err);
            } finally {
              isAlertVisible = false;
              resolve(false);
            }
          },
        },
      ],
    });
  });
};

/**
 * === Generic Safe Permission Handler ===
 */
const ensurePermission = async (perm, title, message) => {
  try {
    const status = await check(perm);

    if (isGranted(status)) return true;

    if (status === RESULTS.DENIED) {
      const next = await request(perm);
      if (isGranted(next)) return true;

      // User denied again → treat as blocked
      await handleBlocked(title, message);
      return false;
    }

    if (status === RESULTS.BLOCKED || status === RESULTS.UNAVAILABLE) {
      await handleBlocked(title, message);
      return false;
    }

    return false;
  } catch (err) {
    console.error(`Permission check failed for ${perm}:`, err);
    Toast.show({
      type: "error",
      text1: "Permission error",
      text2: `Unable to check ${title.toLowerCase()} permission.`,
    });
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/*                              CAMERA PERMISSION                             */
/* -------------------------------------------------------------------------- */
export const ensureCameraPermission = () =>
  ensurePermission(
    Platform.OS === "android"
      ? PERMISSIONS.ANDROID.CAMERA
      : PERMISSIONS.IOS.CAMERA,
    "Camera permission required",
    "Please enable camera access in Settings to take a picture."
  );

/* -------------------------------------------------------------------------- */
/*                            PHOTOS / GALLERY ACCESS                         */
/* -------------------------------------------------------------------------- */
export const ensurePhotoPermission = async () => {
  if (Platform.OS === "ios") {
    const status = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;
    const next = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
    return next === RESULTS.GRANTED || next === RESULTS.LIMITED;
  }

  const api = Platform.Version;
  // ✅ Android 14+ uses built-in PhotoPicker, no runtime permission required
  if (api >= 34) return true;

  const perms =
    api >= 33
      ? [PERMISSIONS.ANDROID.READ_MEDIA_IMAGES]
      : [PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE];

  for (const perm of perms) {
    const status = await check(perm);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;
    const next = await request(perm);
    if (next === RESULTS.GRANTED || next === RESULTS.LIMITED) return true;
  }
  await handleBlocked(
    "Photos permission required",
    "Please enable photo/media access in Settings to pick images or videos."
  );
  return false;
};


/* -------------------------------------------------------------------------- */
/*                           STORAGE / FILE ACCESS (Android 12 fix)           */
/* -------------------------------------------------------------------------- */
export const ensureStoragePermission = async () => {
  if (Platform.OS !== "android") return true;

  const api = Platform.Version;

  // ✅ Android 13+ → Scoped storage (no need for old permissions)
  if (api >= 33) return true;

  // ✅ Android 10–12 → READ_EXTERNAL_STORAGE only (WRITE is ignored)
  const perm =
    api >= 29
      ? PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
      : PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE;

  const ok = await ensurePermission(
    perm,
    "Storage permission required",
    "Please enable file access in Settings to save or open reports."
  );

  return ok;
};

/* -------------------------------------------------------------------------- */
/*                             NOTIFICATION ACCESS                            */
/* -------------------------------------------------------------------------- */
export const ensureNotificationPermission = async () => {
  if (Platform.OS === "ios") {
    return ensurePermission(
      PERMISSIONS.IOS.NOTIFICATIONS,
      "Notification permission required",
      "Please enable notifications in Settings to receive updates."
    );
  }

  const api = Platform.Version;

  if (api >= 33) {
    try {
      const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);

      if (status === RESULTS.DENIED) {
        const next = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        if (isGranted(next)) {
          OneSignal.User.pushSubscription.optIn();
          return true;
        }
        await handleBlocked(
          "Notification permission required",
          "Please enable notifications in Settings to receive updates."
        );
        OneSignal.User.pushSubscription.optOut();
        return false;
      }

      if (isGranted(status)) {
        OneSignal.User.pushSubscription.optIn();
        return true;
      }

      await handleBlocked(
        "Notification permission required",
        "Please enable notifications in Settings to receive updates."
      );
      OneSignal.User.pushSubscription.optOut();
      return false;
    } catch (err) {
      console.error("Notification permission error:", err);
      return false;
    }
  }

  // Android 12 and below → no POST_NOTIFICATIONS permission
  return new Promise((resolve) => {
    if (isAlertVisible) return resolve(false);
    isAlertVisible = true;

    Alert.alert(
      "Enable Notifications",
      "Do you want to receive notifications for updates?",
      [
        {
          text: "No",
          style: "cancel",
          onPress: () => {
            OneSignal.User.pushSubscription.optOut();
            isAlertVisible = false;
            resolve(false);
          },
        },
        {
          text: "Yes",
          onPress: () => {
            OneSignal.User.pushSubscription.optIn();
            isAlertVisible = false;
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
};

/* -------------------------------------------------------------------------- */
/*                             BLUETOOTH ACCESS                               */
/* -------------------------------------------------------------------------- */
export const ensureBluetoothPermission = async () => {
  if (Platform.OS !== "android") return true;

  const api = Platform.Version;
  const perms =
    api >= 31
      ? [
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      ]
      : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];

  for (const perm of perms) {
    const ok = await ensurePermission(
      perm,
      "Bluetooth permission required",
      "Please enable Bluetooth access in Settings to scan and connect to printers."
    );
    if (!ok) return false;
  }
  return true;
};

/* -------------------------------------------------------------------------- */
/*                          LOCATION SERVICES (Android)                       */
/* -------------------------------------------------------------------------- */
export const isLocationServicesLikelyOff = async () => {
  // Without a native LocationManager check, we detect by attempting a coarse permission re-check.
  // If permission is granted, but scans still fail, we’ll still prompt from the screen.
  // Consider implementing a native check for true accuracy.
  return false;
};

// Update: ensureLocationEnabled now nudges system Location if needed
export const ensureLocationEnabled = async () => {
  if (Platform.OS !== "android") return true;
  const api = Platform.Version;

  // Android 13+ (API 33+) does not require Location for BLE scan in most cases
  if (api >= 33) return true;

  // 1) Ask for permission (your existing flow)
  const okFine = await ensurePermission(
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    "Location permission required",
    "Please enable device location in Settings to discover nearby Bluetooth printers."
  );
  if (!okFine) return false;

  // 2) If services might be OFF, prompt to turn on
  try {
    const off = await isLocationServicesLikelyOff();
    if (off) {
      // Let screen control the UI, return false so caller can show an alert.
      return false;
    }
  } catch { }
  return true;
};