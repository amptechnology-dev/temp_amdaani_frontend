// src/context/AuthContext.js
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import {
  resetToAuth,
  resetToMainTabs,
  resetToOnboarding,
} from '../navigation/navigation';
import api, { setAuthHandlers } from '../utils/api';
import SplashScreen from '../screens/SplashScreen';
import { ensureNotificationPermission } from '../utils/permissions';
import OnboardingScreen from '../components/OnboardingScreen';
import { extractErrorMessage } from '../utils/errorHandler';

export const roles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
};

export const permissions = {
  ALL: 'all',
  CAN_MANAGE_USERS: 'manage_users',
  CAN_MANAGE_STORE: 'manage_store',
  CAN_MANAGE_PRODUCTS: 'manage_products',
  CAN_MANAGE_CATEGORIES: 'manage_categories',
  CAN_CREATE_INVOICES: 'create_invoices',
  CAN_EDIT_INVOICES: 'edit_invoices',
  CAN_CANCEL_INVOICES: 'cancel_invoices',
  CAN_VIEW_INVOICES: 'view_invoices',
  CAN_MANAGE_SETTINGS: 'manage_settings',
  CAN_MANAGE_STOCKS: 'manage_stocks',
  CAN_MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  CAN_CREATE_PURCHASES: 'create_purchases',
  CAN_EDIT_PURCHASES: 'edit_purchases',
  CAN_CANCEL_PURCHASES: 'cancel_purchases',
  CAN_VIEW_PURCHASES: 'view_purchases',
};

export let isBootstrapping = true;
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    tempToken: null,
  });
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // subscription state
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    setAuthHandlers(updateAuthState, logout);
  }, []);

  // bootstrap auth with minimum splash duration
  useEffect(() => {
    let isMounted = true;
    const loadAuth = async () => {
      const startTime = Date.now();
      const MIN_SPLASH_DURATION = 2000; // 2 seconds minimum splash

      try {
        const onboardingCompleted = await AsyncStorage.getItem(
          '@onboarding_completed',
        );
        if (isMounted) {
          setHasCompletedOnboarding(onboardingCompleted === 'true');
        }
        const storedAuth = await AsyncStorage.getItem('auth');

        if (storedAuth) {
          const parsedAuth = JSON.parse(storedAuth);

          if (parsedAuth.accessToken) {
            const decoded = jwtDecode(parsedAuth.accessToken);

            if (decoded.exp * 1000 > Date.now()) {
              // Token valid
              if (isMounted) {
                setAuthState({ ...parsedAuth, isAuthenticated: true });
              }
            } else if (parsedAuth.refreshToken) {
              // Try refreshing
              try {
                const res = await api.post('/auth/refresh-tokens', {
                  refreshToken: parsedAuth.refreshToken,
                });

                if (res.success && res.data) {
                  const updatedAuth = {
                    ...parsedAuth,
                    accessToken: res.data.accessToken,
                    refreshToken: res.data.refreshToken,
                    isAuthenticated: true,
                  };
                  await AsyncStorage.setItem(
                    'auth',
                    JSON.stringify(updatedAuth),
                  );

                  if (isMounted) {
                    setAuthState(updatedAuth);
                  }
                } else {
                  if (isMounted) {
                    setAuthState({ isAuthenticated: false });
                  }
                }
              } catch (refreshErr) {
                if (isMounted) {
                  setAuthState({ isAuthenticated: false });
                }
              }
            } else {
              if (isMounted) {
                setAuthState({ isAuthenticated: false });
              }
            }
          }
        } else {
          if (isMounted) {
            setAuthState({ isAuthenticated: false });
          }
        }
      } catch (err) {
        // console.log('[Auth] Bootstrap error:', err);
        if (isMounted) {
          setAuthState({ isAuthenticated: false });
        }
      } finally {
        // Ensure minimum splash duration
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_SPLASH_DURATION - elapsedTime);

        setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, remainingTime);
      }
    };

    loadAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      ensureNotificationPermission();
      fetchUserProfile();
      // console.log('subscribe');
    }
  }, [authState.isAuthenticated]);

  // fetch subscription only after authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setUsage(null);
    }
  }, [authState.isAuthenticated]);

  const fetchSubscription = async () => {
    setSubLoading(true);
    try {
      const response = await api.get('/subscription/get-active-subscriptions');
      if (response.data && response.data.subscription) {
        setSubscription(response.data.subscription);
        setUsage(response.data.usage);
        // console.log('[Subscription] data:', response.data);
      } else {
        setSubscription(null);
        setUsage(null);
      }
    } catch (err) {
      console.error('[Subscription] Error:', err);
    } finally {
      setSubLoading(false);
    }
  };

  const canCreateInvoice = () => {
    // console.log('Can Create Invoice Subscription:', subscription);
    if (!subscription) {
      return {
        allowed: false,
        reason: 'no-subscription',
        message: 'No active subscription found. Please subscribe to a plan.',
      };
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    if (now > endDate) {
      return {
        allowed: false,
        reason: 'expired',
        message: 'Your subscription has expired. Please renew your plan.',
      };
    }

    if (usage && subscription.usageLimits?.invoices !== undefined) {
      if (
        subscription?.usageLimits?.unlimited !== true &&
        usage.invoicesUsed >= subscription.usageLimits.invoices
      ) {
        return {
          allowed: false,
          reason: 'limit',
          message:
            'You have reached your invoice limit. Please upgrade your plan.',
        };
      }
    }

    return { allowed: true };
  };

  const fetchUserProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      console.log('[Auth] User profile:', res.data);
      if (res.success && res.data) {
        setAuthState(prev => ({
          ...prev,
          user: { ...prev.user, ...res.data },
        }));
        await AsyncStorage.setItem(
          'auth',
          JSON.stringify({
            ...authState,
            user: { ...authState.user, ...res.data },
          }),
        );
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch user profile:', error);
    }
  };

  const hasPermission = requiredPermission => {
    const userRole = authState?.user?.role;

    if (!userRole) return false;

    // Check if role has specific permission or 'all'
    const userPermissions = userRole.permissions || [];
    return (
      userPermissions.includes(permissions.ALL) ||
      userPermissions.includes(requiredPermission)
    );
  };

  const updateAuthState = async newState => {
    setAuthState(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newState)) return prev;
      return newState;
    });
    await AsyncStorage.setItem('auth', JSON.stringify(newState));
  };

  const setAuthFromStorage = async () => {
    const storedAuth = await AsyncStorage.getItem('auth');
    if (storedAuth) {
      const parsedAuth = JSON.parse(storedAuth);
      setAuthState(parsedAuth);
      // console.log('[Auth] Context updated from storage');
    }
  };

  const sendOtp = async phone => {
    try {
      const res = await api.post('/auth/get-otp', { phone });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: res.message });
      }
      return res;
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
      return { success: false, message: err.message || 'Failed to send OTP' };
    }
  };

  const verifyOtp = async (phone, otp) => {
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp });
      if (res.success) {
        if (res.data?.user) {
          const newAuthState = {
            isAuthenticated: true,
            user: res.data.user,
            accessToken: res.data.tokens.accessToken,
            refreshToken: res.data.tokens.refreshToken,
            tempToken: null,
          };
          await updateAuthState(newAuthState);
          // resetToMainTabs();
        } else if (res.data?.tempToken) {
          setAuthState(prev => ({ ...prev, tempToken: res.data.tempToken }));
        }
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message || 'Failed to verify OTP' };
    }
  };

  const completeRegistration = async formData => {
    try {
      const res = await api.post('/auth/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${authState.tempToken}`,
        },
      });
      if (res.success) {
        const newAuthState = {
          isAuthenticated: true,
          user: res.data.user,
          accessToken: res.data.tokens.accessToken,
          refreshToken: res.data.tokens.refreshToken,
          tempToken: null,
        };
        await updateAuthState(newAuthState);
      }
      return res;
    } catch (err) {
      return {
        success: false,
        message:
          err?.response?.data?.message || err.message || 'Registration failed',
      };
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_completed', 'true');
      setHasCompletedOnboarding(true);
      // resetToAuth();
      // console.log('[Onboarding] Completed successfully');
    } catch (error) {
      console.error('[Onboarding] Error saving status:', error);
    }
  };

  const logout = async (showToast = true) => {
    const emptyState = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      tempToken: null,
    };
    await AsyncStorage.removeItem('auth');
    setAuthState(emptyState);
    setSubscription(null);
    setUsage(null);
    resetToAuth();
    if (showToast) {
      Toast.show({ type: 'info', text1: 'Logged out' });
    }
  };

  const getStoreSetting = (key, defaultValue = null) => {
    return authState?.user?.store?.settings?.[key] ?? defaultValue;
  };

  const getUserPreference = (key, defaultValue = null) => {
    if (!authState?.user?.preferences) return defaultValue;

    if (key.includes('.')) {
      const parts = key.split('.');
      let current = authState.user.preferences;
      for (const part of parts) {
        if (current === null || current === undefined) return defaultValue;
        current = current[part];
      }
      return current ?? defaultValue;
    }

    return authState.user.preferences[key] ?? defaultValue;
  };

  const isStockEnabled = useMemo(() => {
    return authState?.user?.store?.settings?.stockManagement === true;
  }, [authState?.user?.store?.settings]);

  const isPurchaseOrderEnabled = useMemo(() => {
    return authState?.user?.store?.settings?.purchaseOrderManagement === true;
  }, [authState?.user?.store?.settings]);

  const contextValue = useMemo(
    () => ({
      authState,
      loading,
      hasCompletedOnboarding,
      updateAuthState,
      setAuthFromStorage,
      sendOtp,
      verifyOtp,
      completeRegistration,
      logout,
      // subscription values
      subscription,
      completeOnboarding,
      usage,
      subLoading,
      fetchSubscription,
      fetchSubscription,
      canCreateInvoice,
      hasPermission,
      fetchUserProfile,
      getStoreSetting,
      getUserPreference,
      isStockEnabled,
      isPurchaseOrderEnabled,
    }),
    [
      authState,
      loading,
      subscription,
      usage,
      subLoading,
      isStockEnabled,
      isPurchaseOrderEnabled,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {loading ? (
        <SplashScreen />
      ) : !hasCompletedOnboarding ? (
        <OnboardingScreen />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
