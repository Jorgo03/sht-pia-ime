import { useEffect, useMemo, useState } from 'react';
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
  // Lazy useState rather than useRef(...).current: reading a ref during render
  // is what the React Compiler flags, and `useRef(new Animated.Value(0.4))`
  // also constructs a throwaway Animated.Value on every single render — the
  // argument is evaluated whether or not the ref already holds one. The lazy
  // initialiser runs exactly once and the value is stable for the component's
  // life, which is what an animated value needs.
  const [opacity] = useState(() => new Animated.Value(0.4));

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
