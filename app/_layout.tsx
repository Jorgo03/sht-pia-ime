import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/i18n';

import { AuthProvider } from '@/contexts/auth-context';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { FiltersProvider } from '@/contexts/filters-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        {/* Above the navigator so the list and map tabs share one filter state. */}
        <FiltersProvider>
          <ThemeProvider value={DarkTheme}>
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
            <StatusBar style="light" />
          </ThemeProvider>
        </FiltersProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
