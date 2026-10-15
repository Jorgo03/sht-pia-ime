import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ease = Easing.bezier(...Motion.easeOut);

/**
 * The header's light/dark switch, animated.
 *
 * The icon shows the theme you'd switch TO (a sun while dark, a moon while
 * light). On a tap the outgoing icon spins away and shrinks while the
 * incoming one spins in and grows, the button gives a small spring, and an
 * accent ring ripples out behind it. With the system's Reduce Motion on, the
 * icons simply cross-fade.
 */
export function ThemeToggleButton({ style, iconColor }: { style: StyleProp<ViewStyle>; iconColor: string }) {
  const { t } = useTranslation();
  const { theme, colors, toggle } = useTheme();
  const reduceMotion = useReducedMotion();

  // 1 = dark theme (sun showing), 0 = light theme (moon showing).
  const progress = useSharedValue(theme === 'dark' ? 1 : 0);
  const press = useSharedValue(1);
  const ripple = useSharedValue(0);

  useEffect(() => {
    const target = theme === 'dark' ? 1 : 0;
    progress.value = reduceMotion
      ? withTiming(target, { duration: Motion.fast })
      : withTiming(target, { duration: Motion.slow + 80, easing: ease });
  }, [theme, reduceMotion, progress]);

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (!reduceMotion) {
      press.value = withSequence(
        withTiming(0.86, { duration: 90 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      );
      ripple.value = 0;
      ripple.value = withTiming(1, { duration: Motion.slow + 180, easing: ease });
    }
    toggle();
  };

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const sunStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return reduceMotion
      ? { opacity: p }
      : { opacity: p, transform: [{ rotate: `${(1 - p) * -120}deg` }, { scale: 0.4 + 0.6 * p }] };
  });

  const moonStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return reduceMotion
      ? { opacity: 1 - p }
      : { opacity: 1 - p, transform: [{ rotate: `${p * 120}deg` }, { scale: 1 - 0.6 * p }] };
  });

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value === 0 ? 0 : 0.45 * (1 - ripple.value),
    transform: [{ scale: 0.7 + 0.9 * ripple.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, buttonStyle]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: theme === 'dark' }}
      accessibilityLabel={t('common.toggleTheme')}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ripple, { borderColor: colors.accent, backgroundColor: colors.accent + '22' }, rippleStyle]}
      />
      <View style={styles.iconBox} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, sunStyle]}>
          <MaterialIcons name="light-mode" size={17} color={iconColor} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, moonStyle]}>
          <MaterialIcons name="dark-mode" size={17} color={iconColor} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  iconBox: { width: 17, height: 17 },
  center: { alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1.5,
  },
});
