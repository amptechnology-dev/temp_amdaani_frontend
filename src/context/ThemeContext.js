// src/context/ThemeContext.js
/**
 * ThemeContext
 * - Supports three modes: 'system' | 'dark' | 'light'
 * - Persists choice in AsyncStorage under key 'themeMode'
 * - When 'system' is selected, the app follows device theme via useColorScheme()
 * - Exposes helpers:
 *     isDark: boolean (current effective mode)
 *     themeMode: 'system'|'dark'|'light'
 *     isUsingSystem: boolean
 *     toggleTheme(): toggle manual dark/light (also switches off 'system')
 *     toggleSystemTheme(): toggle following system on/off
 *     setThemeMode(mode): set explicit mode
 *     theme: theme object (darkTheme or lightTheme)
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme/theme';

const STORAGE_KEY = 'themeMode'; // values: 'system' | 'dark' | 'light'

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const colorScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('system'); // default 'system'
  const [lastManual, setLastManual] = useState('light'); // remembers last manual choice

  // Load persisted mode once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (saved === 'system' || saved === 'dark' || saved === 'light') {
          setThemeModeState(saved);
          if (saved === 'dark' || saved === 'light') setLastManual(saved);
        } else {
          setThemeModeState('system');
        }
      } catch (err) {
        console.warn('ThemeContext: failed to load theme mode', err);
        setThemeModeState('system');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist themeMode whenever it changes
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, themeMode);
      } catch (err) {
        console.warn('ThemeContext: failed to save theme mode', err);
      }
    })();
  }, [themeMode]);

  // compute effective boolean dark flag
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return colorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, colorScheme]);

  // toggle manual theme (will set explicit 'dark' or 'light' and stop following system)
  const toggleTheme = () => {
    setThemeModeState(prev => {
      // If currently system, set manual to opposite of current computed value
      if (prev === 'system') {
        const newMode = isDark ? 'light' : 'dark';
        setLastManual(newMode);
        return newMode;
      }
      // if currently 'dark' -> 'light', else 'dark'
      const newMode = prev === 'dark' ? 'light' : 'dark';
      setLastManual(newMode);
      return newMode;
    });
  };

  // toggle whether to follow system. If switching off system, revert to lastManual.
  const toggleSystemTheme = () => {
    setThemeModeState(prev => {
      if (prev === 'system') {
        // turn system off, go to last manual
        return lastManual || 'light';
      } else {
        // turn system on
        return 'system';
      }
    });
  };

  // set explicit mode: 'system' | 'dark' | 'light'
  const setThemeMode = mode => {
    if (mode !== 'system' && mode !== 'dark' && mode !== 'light') return;
    setThemeModeState(mode);
    if (mode === 'dark' || mode === 'light') setLastManual(mode);
  };

  // pick the theme object used by react-native-paper (your theme files)
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        themeMode,
        isUsingSystem: themeMode === 'system',
        toggleTheme,
        toggleSystemTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
export default ThemeContext;
