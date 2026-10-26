import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  ARCH,
  DOOR,
  DOOR_COLOR,
  DOOR_OPEN_DEG,
  DOORWAY,
  HINGE,
  KNOB,
  SPLASH,
  SPLASH_IMAGE_WIDTH,
  TIMELINE,
  toSplashBox,
} from '@/src/features/brand/doorLogo';

/**
 * Launch animation: the logo's door swings open onto a softly lit room, then
 * the app fades in.
 *
 * It takes over from the native splash in the same place and size (app.json
 * expo-splash-screen: splash-door.png, 200 pt wide, the same backgrounds).
 * The logo is the brand master's own path (src/features/brand/doorLogo.js),
 * split into:
 * - the arch, which never moves;
 * - the door with its knob, which turns about the hinge in 3D.
 *
 * The room sits behind the door, invisible until it opens, so the first frame
 * is exactly the logo.
 *
 * Phones only, once per launch. A tap skips it. With reduced motion it only
 * fades.
 */

const BOX = SPLASH_IMAGE_WIDTH;
const VIEWBOX = `0 0 ${SPLASH.viewBox} ${SPLASH.viewBox}`;
const PLACE = `translate(${SPLASH.x} ${SPLASH.y}) scale(${SPLASH.scale})`;
const HINGE_PT = toSplashBox(HINGE, BOX);
/** Same backgrounds as the native splash (app.json), so the hand-off is invisible. */
const BACKGROUND = { light: '#FFFFFF', dark: '#0e0b09' } as const;

export function DoorSplashAnimation({ onFinished }: { onFinished: () => void }) {
  const scheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const door = useSharedValue(0);
  const light = useSharedValue(0);
  const enter = useSharedValue(0);
  const fade = useSharedValue(1);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinished();
  }, [onFinished]);

  useEffect(() => {
    const end = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(finish)();
    };
    if (reduceMotion) {
      fade.value = withDelay(TIMELINE.reducedHold, withTiming(0, { duration: TIMELINE.reducedFade }, end));
    } else {
      door.value = withDelay(
        TIMELINE.doorStart,
        withTiming(1, { duration: TIMELINE.doorEnd - TIMELINE.doorStart, easing: Easing.bezier(0.42, 0, 0.2, 1) }),
      );
      light.value = withDelay(
        TIMELINE.doorStart + 50,
        withTiming(1, { duration: TIMELINE.end - TIMELINE.doorStart - 300, easing: Easing.out(Easing.cubic) }),
      );
      enter.value = withDelay(
        TIMELINE.enterStart,
        withTiming(1, { duration: TIMELINE.end - TIMELINE.enterStart, easing: Easing.inOut(Easing.quad) }),
      );
      fade.value = withDelay(
        TIMELINE.fadeStart,
        withTiming(0, { duration: TIMELINE.end - TIMELINE.fadeStart, easing: Easing.out(Easing.quad) }, end),
      );
    }
    // Whatever happens to the animation, the app is never left covered.
    const safety = setTimeout(finish, TIMELINE.end + 1500);
    return () => clearTimeout(safety);
  }, [door, enter, fade, finish, light, reduceMotion]);

  const skip = () => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value IS its API, and it is a worklet value, not React state. The compiler rule does not model SharedValue.
    fade.value = withTiming(0, { duration: TIMELINE.skipFade }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  };

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.1 * enter.value }] }));
  const doorStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 260 }, { rotateY: `${DOOR_OPEN_DEG * door.value}deg` }],
  }));
  const roomStyle = useAnimatedStyle(() => ({ opacity: light.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.85 * light.value }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: 0.5 * enter.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: BACKGROUND[scheme === 'dark' ? 'dark' : 'light'] }, rootStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessible={false} />
      <Animated.View style={[styles.box, logoStyle]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <Glow />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, roomStyle]}>
          <Room />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]}>
          <Bloom />
        </Animated.View>
        <Svg width={BOX} height={BOX} viewBox={VIEWBOX} style={StyleSheet.absoluteFill}>
          <G transform={PLACE}>
            <Path d={ARCH} fill={DOOR_COLOR} />
          </G>
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, styles.hinge, doorStyle]}>
          <Svg width={BOX} height={BOX} viewBox={VIEWBOX}>
            <G transform={PLACE}>
              <Path d={DOOR + KNOB} fill={DOOR_COLOR} fillRule="evenodd" />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Warm light spilling from the doorway onto the background. */
function Glow() {
  return (
    <Svg width={BOX} height={BOX} viewBox={VIEWBOX}>
      <Defs>
        <RadialGradient id="door-glow" cx="128" cy="160" r="118" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFC46B" stopOpacity="0.45" />
          <Stop offset="0.55" stopColor="#FFB45E" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FFB45E" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G transform={PLACE}>
        <Circle cx="128" cy="160" r="118" fill="url(#door-glow)" />
      </G>
    </Svg>
  );
}

/** The room behind the door: a warm wall, a window, a sofa and a pendant lamp. */
function Room() {
  return (
    <Svg width={BOX} height={BOX} viewBox={VIEWBOX}>
      <Defs>
        <ClipPath id="door-room-clip">
          <Path d={DOORWAY} />
        </ClipPath>
        <LinearGradient id="door-wall" x1="0" y1="43" x2="0" y2="231" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFF4E3" />
          <Stop offset="1" stopColor="#FFDDB0" />
        </LinearGradient>
        <LinearGradient id="door-floor" x1="0" y1="198" x2="0" y2="231" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F4C28C" />
          <Stop offset="1" stopColor="#E6A266" />
        </LinearGradient>
        <RadialGradient id="door-lamp" cx="153" cy="106" r="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="0.4" stopColor="#FFE6B3" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFE6B3" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G transform={PLACE}>
        <G clipPath="url(#door-room-clip)">
          <Rect x="72" y="43" width="112" height="188" fill="url(#door-wall)" />
          <Path d="M72,206L184,198V231H72Z" fill="url(#door-floor)" />
          <Rect x="86" y="112" width="34" height="46" rx="3" fill="#FFF9F0" />
          <Line x1="103" y1="112" x2="103" y2="158" stroke="#F1CC9C" strokeWidth="1.5" />
          <Line x1="86" y1="135" x2="120" y2="135" stroke="#F1CC9C" strokeWidth="1.5" />
          <Rect x="80" y="173" width="40" height="13" rx="5" fill="#E39158" opacity="0.4" />
          <Rect x="78" y="183" width="44" height="16" rx="6" fill="#E39158" opacity="0.55" />
          <Line x1="153" y1="43" x2="153" y2="95" stroke="#D98B4F" strokeWidth="1.2" opacity="0.7" />
          <Path d="M145,103A8,8 0 0 1 161,103Z" fill="#D98B4F" opacity="0.85" />
          <Circle cx="153" cy="106" r="42" fill="url(#door-lamp)" />
        </G>
      </G>
    </Svg>
  );
}

/** A warm-white wash inside the doorway: the light of stepping in. */
function Bloom() {
  return (
    <Svg width={BOX} height={BOX} viewBox={VIEWBOX}>
      <G transform={PLACE}>
        <Path d={DOORWAY} fill="#FFF8EC" />
      </G>
    </Svg>
  );
}

/** If drawing the animation fails for any reason, the app simply shows. */
class SplashBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Once per launch: a remount of the root (fast refresh, auth gate) never replays it.
let playedThisLaunch = false;

/** The launch animation, on the phones only, over the app's first screen. */
export function LaunchDoorSplash() {
  const [show, setShow] = useState(() => Platform.OS !== 'web' && !playedThisLaunch);
  useEffect(() => {
    playedThisLaunch = true;
  }, []);
  const hide = useCallback(() => setShow(false), []);
  if (!show) return null;
  return (
    <SplashBoundary onError={hide}>
      <DoorSplashAnimation onFinished={hide} />
    </SplashBoundary>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  box: { width: BOX, height: BOX },
  // The door turns about its own hinge: the right edge of the panel.
  hinge: { transformOrigin: [HINGE_PT.x, HINGE_PT.y, 0] },
});
