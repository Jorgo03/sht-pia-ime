import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * A list that could not be loaded, with a way to try again. Without it a
 * failed read fell through to the empty state: "no viewings", "no listings",
 * when the truth was "the network dropped". Same look as Messages' error.
 */
export function LoadError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <MaterialIcons name="error-outline" size={40} color={colors.accent} />
      <Text style={styles.text}>{message ?? t('errors.loadFailed')}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onRetry} activeOpacity={0.7} hitSlop={8} style={styles.button}>
        <Text style={styles.retry}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
    text: { fontFamily: Fonts.sans, fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
    retry: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
  });
