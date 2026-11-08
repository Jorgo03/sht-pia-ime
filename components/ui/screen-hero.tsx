import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * The serif headline that opens Favorites, Messages, Viewings, Saved searches
 * and the agent dashboard (web's `.screen-headline`). The small label above
 * it was removed at the owner's request. One copy, so the space around it is one rule: 16 above
 * (below the header's line), 20 below, on the 20px page gutter. The content
 * that follows adds no top margin of its own.
 */
export function ScreenHero({ pre, em }: { pre: string; em: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.hero}>
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
    headline: {
      fontFamily: Fonts?.serif,
      fontSize: 28,
      color: colors.textPrimary,
    },
    // The italic font file: fontStyle on the upright one is slanted on Android
    // and ignored on iOS, so the two phones drew different headlines.
    headlineEm: {
      fontFamily: Fonts?.serifItalic,
      color: colors.accentText,
    },
  });
