import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ErrorBoundaryProps } from 'expo-router';

import i18n from '@/i18n';
import { AtticoColorsDark, Fonts } from '@/constants/theme';

/**
 * Route-level crash screen, exported from app/_layout.tsx so expo-router
 * wraps the whole app in it (see its `fromImport` → `<Try catch={...}>`).
 *
 * Replaces expo-router's built-in fallback, which renders `Error: {message}`
 * verbatim with no __DEV__ guard — so a production crash showed users raw
 * internal error text, in English, on an unbranded screen.
 *
 * Reads the i18n singleton and the static dark palette rather than
 * useTranslation()/useTheme(): this component renders *outside* the providers
 * RootLayout sets up, so those contexts do not exist here. The dark palette is
 * the safe pick — it matches the DuskHero/auth surface the app already shows
 * before the theme context resolves.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) {
    // Full detail stays in the dev console, never on screen.
    console.error('[ErrorBoundary] uncaught render error:', error);
  }

  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <MaterialIcons name="error-outline" size={30} color={AtticoColorsDark.accent} />
      </View>

      <Text style={styles.title}>{i18n.t('errors.generic')}</Text>

      {/* error.message is deliberately not rendered — it can carry internal
          detail (ids, query text) and is not translated. */}
      <TouchableOpacity onPress={retry} activeOpacity={0.85} accessibilityRole="button">
        <LinearGradient
          colors={[AtticoColorsDark.accent, AtticoColorsDark.accentEnd]}
          style={styles.cta}>
          <Text style={styles.ctaText}>{i18n.t('common.retry')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
    backgroundColor: AtticoColorsDark.primary,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AtticoColorsDark.accentGlow,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    textAlign: 'center',
    color: AtticoColorsDark.textPrimary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: Fonts?.sansBold,
    fontSize: 15,
    color: '#fff',
  },
});
