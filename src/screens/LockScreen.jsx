import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { BlurView } from '@react-native-community/blur';
import { useAppLock } from '../context/AppLockContext';

export default function LockScreen() {
  const { unlock, biometryType } = useAppLock();
  const [busy, setBusy] = useState(false);

  // Auto-trigger biometric once when screen mounts
  useEffect(() => {
    handleUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlock();   // shows biometric / device PIN
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Blur overlay */}
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={12}
        reducedTransparencyFallbackColor="black"
      />

      <View style={styles.center}>
        <Text variant="headlineSmall" style={styles.title}>App Locked</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {biometryType
            ? `Authenticate with ${biometryType} to continue`
            : 'Authenticate to continue'}
        </Text>

        <View style={{ height: 24 }} />

        <Button mode="contained" onPress={handleUnlock} disabled={busy}>
          {busy ? <ActivityIndicator animating color="white" /> : 'Unlock'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 8, color: 'white' },
  subtitle: { textAlign: 'center', opacity: 0.8, color: 'white' },
});
