import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * The kicker + serif headline that opens Favorites, Messages, Viewings, Saved
 * searches and the agent dashboard (web's `.screen-kicker` /
 * `.screen-headline`). One copy, so the space around it is one rule: 16 above
 * (below the header's line), 20 below, on the 20px page gutter. The content
 * that follows adds no top margin of its own.
 */
export function ScreenHero({ kicker, pre, em }: { kicker: ReactNode; pre: string; em: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.hero}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerDash} />
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      <Text style={styles.headline} accessibilityRole="header">
        {pre} <Text style={styles.headlineEm}>{em}</Text>
      </Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    hero: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    kickerDash: {
      width: 14,
      height: 1,
      backgroundColor: colors.accent,
    },
    kicker: {
      flexShrink: 1,
      fontFamily: Fonts?.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      fontWeight: '600',
    },
    headline: {
      fontFamily: Fonts?.serif,
      fontSize: 28,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    headlineEm: {
      fontStyle: 'italic',
      color: colors.accentText,
    },
  });
