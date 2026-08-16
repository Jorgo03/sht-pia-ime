import { ThemeProvider as NavigationThemeProvider, Theme as NavigationTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  Newsreader_600SemiBold_Italic,
} from '@expo-google-fonts/newsreader';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '@/i18n';

import { AuthProvider } from '@/contexts/auth-context';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { FiltersProvider } from '@/contexts/filters-context';
import { ThemeProvider as FhoThemeProvider, useFhoTheme } from '@/contexts/theme-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Newsreader_600SemiBold_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  return (
    <AuthProvider>
      <FavoritesProvider>
        {/* Above the navigator so the list and map tabs share one filter state. */}
        <FiltersProvider>
          <FhoThemeProvider>
            <AppShell fontsLoaded={fontsLoaded} />
          </FhoThemeProvider>
        </FiltersProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors, isDark, isReady } = useFhoTheme();

  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) {
    return null;
  }

  const navigationTheme: NavigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.orange1,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.orange1,
    },
    fonts: {
      regular: { fontFamily: 'Manrope_400Regular', fontWeight: '400' },
      medium: { fontFamily: 'Manrope_500Medium', fontWeight: '500' },
      bold: { fontFamily: 'Manrope_700Bold', fontWeight: '700' },
      heavy: { fontFamily: 'Manrope_800ExtraBold', fontWeight: '800' },
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="property/[id]"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="listing/create"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
