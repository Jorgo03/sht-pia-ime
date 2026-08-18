import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/** Matches web's SkeletonCard.jsx: a card-shaped placeholder (image block +
 *  two text lines) with a pulsing shimmer, shown in a grid while property
 *  data loads — not a spinner replacing the whole screen. RN has no CSS
 *  gradient-sweep animation primitive, so this uses an opacity pulse
 *  instead; same intent (visible loading skeleton, not a blank/spinner
 *  screen), different mechanism. */
export function SkeletonCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.block, styles.image, { opacity }]} />
      <Animated.View style={[styles.block, styles.lineWide, { opacity }]} />
      <Animated.View style={[styles.block, styles.lineNarrow, { opacity }]} />
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 8,
    margin: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  block: {
    borderRadius: 6,
    backgroundColor: colors.glass,
  },
  image: {
    height: 90,
    marginBottom: 8,
  },
  lineWide: {
    height: 14,
    width: '60%',
    marginBottom: 6,
  },
  lineNarrow: {
    height: 12,
    width: '40%',
  },
});
