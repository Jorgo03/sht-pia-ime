import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * An agent-only screen reached by a signed-in client (a typed address, an old
 * link). The database already returns a client nothing of an agent's; this
 * keeps the agent tools themselves out of sight too (parity brief §8).
 */
export function AgentsOnly() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <View style={styles.center}>
          <Text style={styles.text} accessibilityRole="header">{t('site.agentsOnly')}</Text>
          <ActionButton title={t('common.home')} onPress={() => router.replace('/' as Href)} />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    text: { fontFamily: Fonts.sansSemiBold, fontSize: 16, lineHeight: 23, color: colors.textPrimary, textAlign: 'center' },
  });
