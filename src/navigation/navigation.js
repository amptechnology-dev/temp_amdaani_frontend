// src/navigation.js (new file)
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function resetToMainTabs() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  } else {
    // If not ready, queue the action (optional, for robustness)
    setTimeout(resetToMainTabs, 100);
  }
}

export function resetToAuth() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  } else {
    setTimeout(resetToAuth, 100);
  }
}

export function resetToOnboarding() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Onboarding' }],
    });
  } else {
    // If not ready, queue the action (optional, for robustness)
    setTimeout(resetToOnboarding, 100);
  }
}