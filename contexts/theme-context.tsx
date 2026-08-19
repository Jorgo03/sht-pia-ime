import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';

import { AtticoColorsDark, AtticoColorsLight, type AtticoPalette } from '@/constants/theme';

type Theme = 'light' | 'dark';

// v2 deliberately abandons the old 'fho_theme' key. The previous version
// persisted whatever theme it *resolved* on first launch (see the removed
// hydration-persist effect below), so every existing install has a
// never-actually-chosen 'dark' written under the old key. Reading that back
// would pin those users to dark forever and silently defeat the light
// default. Ignoring the old key is the migration.
const STORAGE_KEY = 'fho_theme_v2';

interface ThemeContextValue {
  theme: Theme;
  colors: AtticoPalette;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Same fallback order as web's ThemeContext.jsx: stored preference, then
  // system preference, then LIGHT.
  //
  // This used to initialise to 'dark' and treat any non-'light' system value
  // as dark — which meant the app rendered its near-black palette while the
  // browser rendered the warm cream one for the same user, on the same
  // account. That single divergence was the biggest visual gap between the
  // two platforms: not spacing or type, just a different theme. Web's rule
  // (see getInitialTheme in src/shared/ThemeContext.jsx) is dark *only* when
  // the OS explicitly asks for it, so this mirrors that exactly.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      } else {
        setTheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
      }
    });
  }, []);

  // Persists only on an explicit toggle. The old code wrote on every theme
  // change *including* the one hydration itself performed, which turned an
  // auto-detected fallback into a stored "preference" the user never made —
  // the reason the light default alone wasn't enough to fix this.
  const toggle = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme === 'dark' ? AtticoColorsDark : AtticoColorsLight,
      toggle,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

/** Convenience for screens that only need the current palette, not the toggle. */
export function useAtticoColors(): AtticoPalette {
  return useTheme().colors;
}
