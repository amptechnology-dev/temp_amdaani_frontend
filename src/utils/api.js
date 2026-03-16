// src/utils/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { isBootstrapping } from '../context/AuthContext';
import { extractErrorMessage } from './errorHandler';
import Config from 'react-native-config';

let updateAuthState = null;
let logoutFn = null;
const BASE_URL = Config.API_BASE_URL;

//'https://pos-dev.amptechnology.in/api'
console.log('CONFIG FULL:', Config);

// 🔑 Allow AuthContext to register its handlers
export const setAuthHandlers = (updateFn, logout) => {
  updateAuthState = updateFn;
  logoutFn = logout;
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach accessToken to every request
api.interceptors.request.use(async config => {
  const storedAuth = await AsyncStorage.getItem('auth');
  if (storedAuth) {
    const { accessToken } = JSON.parse(storedAuth);
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// --- SINGLE refresh lock ---
let refreshPromise = null;

api.interceptors.response.use(
  response => response.data,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const storedAuth = await AsyncStorage.getItem('auth');
            if (!storedAuth) throw new Error('No auth found');
            const { accessToken, refreshToken } = JSON.parse(storedAuth);

            // console.log('[Auth] Attempting token refresh...');

            // 🚀 Refresh call
            const res = await axios.post(
              `${BASE_URL}/auth/refresh-tokens`,
              { refreshToken },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`, // expired token
                  'Content-Type': 'application/json',
                },
              },
            );

            if (res.data?.success && res.data?.data) {
              // console.log('[Auth] Refresh successful');
              const newTokens = {
                accessToken: res.data.data.accessToken,
                refreshToken: res.data.data.refreshToken,
              };

              const updatedAuth = {
                ...JSON.parse(storedAuth),
                ...newTokens,
                isAuthenticated: true,
              };

              // save to storage
              await AsyncStorage.setItem('auth', JSON.stringify(updatedAuth));

              // update AuthContext state
              if (updateAuthState) {
                await updateAuthState(updatedAuth);
              }

              return newTokens;
            }

            throw new Error('Refresh failed');
          } catch (err) {
            // console.log('[Auth] Refresh failed:', err?.message || err);

            // 🚫 Don’t trigger reset if app is still bootstrapping
            if (!isBootstrapping) {
              const wasLoggedIn = JSON.parse(
                (await AsyncStorage.getItem('auth')) || '{}',
              )?.isAuthenticated;

              await AsyncStorage.removeItem('auth');

              if (wasLoggedIn) {
                Toast.show({
                  type: 'error',
                  text1: 'Session Expired',
                  text2: 'Please log in again',
                });
              }

              if (logoutFn) logoutFn(false); // silent option
            }

            throw err;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      try {
        const newTokens = await refreshPromise;
        // retry original request with new accessToken
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    // other errors
    if (
      error.response?.data?.message ===
      'No active subscription found for this store!'
    )
      return;

    //const message = error.response?.data?.message || 'Something went wrong';
    const message = extractErrorMessage(error);

    // Toast.show({ type: 'error', text1: 'Error', text2: message });

    // console.log('Error:', message);
    error.message = message;
    return Promise.reject(error);
  },
);

export default api;
