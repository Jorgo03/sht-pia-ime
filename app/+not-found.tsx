import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

// The page an unknown address lands on, on the website and for a deep link
// the app does not know. Same content as the website's NotFound page
// (src/shared/pages/NotFound.jsx): 404, the title, the subtitle, Home and
// Search. Its <title> comes from RouteHead in the root layout.
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />
        <View style={styles.content}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title} accessibilityRole="header">{t('notFound.title')}</Text>
          <Text style={styles.subtitle}>{t('notFound.subtitle')}</Text>
          <View style={styles.actions}>
            <PrimaryCTA label={t('common.home')} icon="home" onPress={() => router.replace('/')} style={styles.action} />
            <GhostBtn
              label={t('common.search')}
              icon="search"
              onPress={() => router.replace('/explore' as Href)}
              style={styles.action}
            />
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 64 },
  code: { fontFamily: Fonts?.serif, fontSize: 60, lineHeight: 64, fontWeight: '500', color: colors.accentText },
  title: { marginTop: 12, fontFamily: Fonts?.serif, fontSize: 22, fontWeight: '500', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { marginTop: 8, fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  actions: { marginTop: 24, width: '100%', maxWidth: 320, gap: 10 },
  action: { width: '100%' },
});
