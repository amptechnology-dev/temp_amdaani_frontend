import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useAppLock } from '../context/AppLockContext';
import LockScreen from '../screens/LockScreen';

export default function AppLockGate({ children }) {
  const { isLocked, isEnabled } = useAppLock();
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {children}
      {isEnabled && isLocked ? (
        <View style={styles.overlay} pointerEvents="auto">
          <LockScreen />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
