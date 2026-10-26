import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * A screen that needs an account, reached signed out: the + button, a deep
 * link, or a notification left in the tray after signing out. Without it the
 * listing form ended in "Authentication failed" after five steps, and other
 * screens waited on a user who never came, a spinner forever. Sign-in lives
 * on the Profile tab, the same as the Messages screen's prompt.
 */
export function SignInPrompt({ message }: { message?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <View style={styles.center}>
          <Text style={styles.description}>{message ?? t('addSheet.signInFirst')}</Text>
          <View style={styles.signInButton}>
            <ActionButton title={t('common.signIn')} onPress={() => router.push('/(tabs)/profile' as Href)} />
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 32,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    signInButton: {
      alignSelf: 'stretch',
      marginTop: 12,
    },
  });
