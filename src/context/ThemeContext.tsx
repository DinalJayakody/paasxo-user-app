import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ThemeColors } from '../styles/colors';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = '@paasxo:themeMode';

type ThemeContextShape = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextShape>({
  mode: 'system',
  resolvedTheme: 'light',
  colors: lightColors,
  setMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  // Until the persisted preference loads, default to the system scheme rather
  // than flashing light-then-dark (or vice versa) a moment later.
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (!loaded || mode === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  }, [loaded, mode, systemScheme]);

  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, resolvedTheme, colors, setMode }),
    [mode, resolvedTheme, colors, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/** Full theme state — mode (system/light/dark), the resolved theme, and setMode. */
export const useTheme = () => useContext(ThemeContext);

/** Convenience for screens that only need the current color tokens. */
export const useThemeColors = (): ThemeColors => useContext(ThemeContext).colors;
