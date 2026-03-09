// AppLockContext.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import ReactNativeBiometrics from "react-native-biometrics";
import { useAuth } from "./AuthContext";

const AppLockContext = createContext(null);
export const useAppLock = () => useContext(AppLockContext);

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export function AppLockProvider({ children }) {
  const { authState } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [biometryType, setBiometryType] = useState(null);

  const unlockingRef = useRef(false);

  // Load lock state for current user
  useEffect(() => {
    const loadLockForUser = async () => {
      if (!authState?.isAuthenticated || !authState.user?._id) {
        setIsEnabled(false);
        setIsLocked(false);
        return;
      }

      const key = `appLockEnabled:${authState.user._id}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored !== null && stored === "true") {
        setIsEnabled(true);
        setIsLocked(true); // lock on first open
      } else {
        setIsEnabled(false);
        setIsLocked(false);
      }
    };

    loadLockForUser();
  }, [authState?.isAuthenticated, authState?.user?._id]);

  // Detect biometry availability
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { available, biometryType } =
          await rnBiometrics.isSensorAvailable();
        if (mounted) setBiometryType(available ? biometryType : null);
      } catch {
        if (mounted) setBiometryType(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const lock = useCallback(() => {
    if (isEnabled) setIsLocked(true);
  }, [isEnabled]);

  const unlock = useCallback(async () => {
    if (unlockingRef.current) return false;
    unlockingRef.current = true;
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage:
          Platform.OS === "ios"
            ? "Unlock with Face ID / Touch ID"
            : "Unlock",
        cancelButtonText: "Cancel",
      });
      if (success) {
        setIsLocked(false);
        unlockingRef.current = false;
        return true;
      }
      unlockingRef.current = false;
      return false;
    } catch {
      unlockingRef.current = false;
      return false;
    }
  }, []);

  const enable = useCallback(async () => {
    if (!authState?.user?._id) return;
    const key = `appLockEnabled:${authState.user._id}`;
    await AsyncStorage.setItem(key, "true");
    setIsEnabled(true);
    setIsLocked(true);
  }, [authState?.user?._id]);

  const disable = useCallback(async () => {
    if (!authState?.user?._id) return;
    const key = `appLockEnabled:${authState.user._id}`;
    await AsyncStorage.setItem(key, "false");
    setIsEnabled(false);
    setIsLocked(false);
  }, [authState?.user?._id]);

  const value = useMemo(
    () => ({
      isEnabled,
      isLocked,
      biometryType,
      enable,
      disable,
      lock,
      unlock,
    }),
    [isEnabled, isLocked, biometryType, enable, disable, lock, unlock]
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}
