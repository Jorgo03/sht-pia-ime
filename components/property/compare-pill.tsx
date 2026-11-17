import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT } from '@/components/liquid-tab-bar';
import { Fonts, Shadows, type AtticoPalette } from '@/constants/theme';
import { useCompare } from '@/contexts/compare-context';
import { useTheme } from '@/contexts/theme-context';

/** Floats above the tab bar while homes are waiting to be compared. */
export function ComparePill() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { ids } = useCompare();

  if (ids.length === 0) return null;
  return (
    <Pressable
      style={[styles.pill, { bottom: insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT + 12 }]}
      onPress={() => router.push('/compare' as Href)}
      accessibilityRole="button"
      accessibilityLabel={t('compare.open', { total: ids.length })}>
      <MaterialIcons name="compare-arrows" size={18} color={colors.accentText} />
      <Text style={styles.label}>{t('compare.open', { total: ids.length })}</Text>
    </Pressable>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    pill: {
      position: 'absolute',
      right: 20,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.primaryLight,
      ...Shadows.nav,
    },
    label: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
  });
