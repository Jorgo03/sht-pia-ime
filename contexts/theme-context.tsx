import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { FhoColorPalette, FhoColors, FhoThemeName } from '@/constants/theme';

/** Same key the web app uses for `localStorage.getItem('fho_theme')`. */
const STORAGE_KEY = 'fho_theme';

interface ThemeContextValue {
  theme: FhoThemeName;
  colors: FhoColorPalette;
  isDark: boolean;
  /** True once the persisted override (if any) has been read from storage. */
  isReady: boolean;
  toggle: () => void;
  setTheme: (theme: FhoThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [override, setOverride] = useState<FhoThemeName | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark') setOverride(stored);
      setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const theme: FhoThemeName = override ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const setTheme = (next: FhoThemeName) => {
    setOverride(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: FhoColors[theme],
      isDark: theme === 'dark',
      isReady,
      toggle,
      setTheme,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, isReady]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useFhoTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useFhoTheme must be used within ThemeProvider');
  return context;
}
