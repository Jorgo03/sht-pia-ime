import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

/**
 * RN port of src/styles/polish.css's motion layer. The web app gets its
 * "alive" feel almost entirely from that stylesheet — entrance motion, press
 * compression, and the favorite-heart pop — none of which had any native
 * equivalent, which is the single biggest reason the mobile app read as flat
 * next to the browser.
 *
 * Timings and curves here are the same values, not approximations:
 * riseIn = 12px rise + fade over --t-slow on --ease-out, staggered 40ms +
 * 50ms per item and capped at 8 (polish.css §2); heartPop = 1 → 1.35 → 1
 * over 350ms on --ease-spring (§4); press scales from §3/§6.
 */

const STAGGER_BASE_MS = 40;
const STAGGER_STEP_MS = 50;
/** polish.css only defines nth-child delays up to 8 so a long "load more"
 *  list doesn't animate for seconds — later items just appear. */
const MAX_STAGGERED_INDEX = 8;

const easeOut = Easing.bezier(...Motion.easeOut);
const easeSpring = Easing.bezier(...Motion.easeSpring);

/**
 * Fades + slides its children up on mount. Pass `index` for list children to
 * get the staggered cascade; leave it out for one-off blocks (screen heads,
 * hero cards) which web animates with no delay offset beyond the base.
 */
export function RiseIn({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = STAGGER_BASE_MS + Math.min(index, MAX_STAGGERED_INDEX) * STAGGER_STEP_MS;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: Motion.slow, easing: easeOut }),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Matches polish.css's `translateY(12px)` start offset.
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Scale-pop for the favorite heart, driven by whether it's currently saved.
 * Only fires on the un-saved → saved transition, matching web (the animation
 * is attached to `.saved svg`, so un-favoriting doesn't replay it).
 */
export function useHeartPop(saved: boolean) {
  const scale = useSharedValue(1);
  const wasSaved = useSharedValue(saved);

  useEffect(() => {
    if (saved && !wasSaved.value) {
      scale.value = withSequence(
        withTiming(1.35, { duration: 350 * 0.45, easing: easeSpring }),
        withTiming(1, { duration: 350 * 0.55, easing: easeSpring }),
      );
    }
    wasSaved.value = saved;
  }, [saved, scale, wasSaved]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return heartStyle;
}

/**
 * Press-compression for cards and buttons. RN's TouchableOpacity only dims
 * opacity; web compresses scale instead, which reads as a firmer, more
 * physical press. Returns handlers to spread onto a Pressable plus the
 * animated style to apply.
 */
export function usePressScale(target: number = Motion.pressScaleCard) {
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return {
    pressStyle,
    onPressIn: () => {
      scale.value = withTiming(target, { duration: Motion.fast, easing: easeOut });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: Motion.fast, easing: easeOut });
    },
  };
}
