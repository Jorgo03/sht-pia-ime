import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { FiltersProvider } from '@/contexts/filters-context';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { queryClient } from '@/lib/query-client';

export const unstable_settings = {
  anchor: '(tabs)',
};

// expo-router picks up a named `ErrorBoundary` export from a route and wraps
// that route in it. Without this, its built-in fallback renders
// `Error: {error.message}` with no __DEV__ guard — raw internal error text,
// in English, shown to production users. Mirrors web's src/shared/ErrorBoundary.
export { AppErrorBoundary as ErrorBoundary } from '@/components/ui/error-boundary';

// Keeps the native splash screen up until fonts are ready, below. Guarded
// because Fast Refresh can re-run this module-scope call more than once in
// dev, which throws "already prevented" — a known-benign duplicate-call
// warning (Expo's own template code guards it the same way), not a real
// error, so it's the one intentional swallow in this file.
SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedNavigation() {
  const { theme } = useTheme();

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
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
        <Stack.Screen
          name="listing/new"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="listing/[id]/analytics"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="favorites/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="messages/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="messages/[id]"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="viewings/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="my-listings/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="agent-dashboard/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="saved-searches/index"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="agent/[id]"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

/**
 * Holds the splash screen until both gates clear, then renders the real
 * app tree exactly once — never a flash of "signed out" before session
 * restore resolves. Several screens (messages, viewings, my-listings, etc.)
 * branch on `useAuth().user` without checking `useAuth().loading` first;
 * fixing that centrally here, once, is simpler and more reliable than
 * touching every one of those screens individually.
 */
function AppGate({ fontsReady }: { fontsReady: boolean }) {
  const { loading: authLoading } = useAuth();
  // Web has no native splash screen (nothing to hold up) and, critically,
  // Expo Router's static export renders this tree in Node to produce each
  // route's static HTML — there `useFonts`/the Supabase session promise
  // never resolve within that synchronous pass, so gating on them there
  // isn't "still loading," it's permanently `false`, which blanked every
  // exported page. The race this gate exists to prevent is native-only
  // (LAN asset requests, iOS/Android session storage) — skip it on web.
  const ready = Platform.OS === 'web' || (fontsReady && !authLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    // Native splash screen is still visible (prevented above) — this isn't
    // a blank in-app screen, just deferring the JS tree's first paint.
    return null;
  }

  return (
    <FavoritesProvider>
      {/* Above the navigator so the list and map tabs share one filter state. */}
      <FiltersProvider>
        <ThemeProvider>
          <ThemedNavigation />
        </ThemeProvider>
      </FiltersProvider>
    </FavoritesProvider>
  );
}

export default function RootLayout() {
  // Root cause of the "Unable to download asset ... MaterialIcons.ttf"
  // errors: nothing preloaded these fonts, so @expo/vector-icons' own
  // per-instance lazy loader (every <MaterialIcons>/<Ionicons> independently
  // calls Font.loadAsync on mount — see its componentDidMount) fired from
  // every icon across the tab bar, headers, and cards all at once on cold
  // launch, right after the JS bundle itself had just finished transferring
  // over LAN — the worst possible moment for a burst of asset requests on a
  // real device's Wi-Fi. Loading both fonts once, up front, before the tree
  // (and its icons) ever mounts removes that race entirely.
  //
  // Also loads the app's actual typography (matching the web app's
  // Newsreader/Manrope/JetBrains Mono pairing — see constants/theme.ts's
  // Fonts export) through the same gate, so the design-brief requirement
  // "do not show the UI before required fonts have loaded" is enforced by
  // construction rather than left to chance.
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontError) {
      // Not swallowed: logged for dev visibility. The app still renders —
      // each icon's own lazy loader (see createIconSet.js) gets a second
      // independent attempt, so a transient failure here degrades to
      // blank icons rather than blocking the whole app.
      console.error('Font preload failed, icons will lazy-load individually as a fallback:', fontError);
    }
  }, [fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* Mounted unconditionally (not behind the font gate) so session
              restore starts immediately and runs in parallel with font
              loading, rather than waiting for fonts to finish first. */}
          <AuthProvider>
            <AppGate fontsReady={fontsLoaded || !!fontError} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
