import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EraAvatar } from '@/components/era/era-avatar';
import { TAB_BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT } from '@/components/liquid-tab-bar';
import { AI_CHAT_ENABLED } from '@/constants/features';
import { Shadows, type AtticoPalette } from '@/constants/theme';
import { IS_WEB } from '@/constants/web-frame';
import { useCompare } from '@/contexts/compare-context';
import { useTheme } from '@/contexts/theme-context';

const SIZE = 58;
const BOX = SIZE + 6;
const MARGIN = 16;
/** Kept clear at the top for each screen's header and title. */
const TOP_CLEARANCE = 132;
const STORE_KEY = 'fho_era_button';
const SPRING = { damping: 20, stiffness: 260 };

/** Where the person left Era: a side, and how far above her home spot. */
type Spot = { side: 'left' | 'right'; up: number };
let spot: Spot = { side: 'right', up: 0 };
let loaded = false;
const remember = (next: Spot) => {
  spot = next;
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
};

/**
 * Era, the assistant, as a round portrait in the bottom-right corner of the
 * tab screens, just above the tab bar (and above the Compare pill when that
 * sits in the same corner). Tap: opens the chat. Drag: she follows the
 * finger, snaps to the nearer side on release, stays between the header and
 * the tab bar, and is in the same place on every tab and after a restart.
 */
export function EraButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { ids } = useCompare();

  const right = Math.max(MARGIN, insets.right + MARGIN);
  const left = Math.max(MARGIN, insets.left + MARGIN);
  const bottom = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT + 12 + (ids.length > 0 ? 56 : 0);
  // How far she can go: across to the left edge, and up to below the header.
  const maxLeft = Math.max(0, width - BOX - right - left);
  const maxUp = Math.max(0, height - bottom - BOX - insets.top - TOP_CLEARANCE);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lifted = useSharedValue(1);

  // Puts her where she was last left (another tab may have moved her).
  const place = useCallback(
    (s: Spot) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value is its API, not React state.
      x.value = s.side === 'left' ? -maxLeft : 0;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value is its API, not React state.
      y.value = -Math.min(Math.max(0, s.up), maxUp);
    },
    [x, y, maxLeft, maxUp],
  );
  useFocusEffect(
    useCallback(() => {
      place(spot);
      if (loaded) return;
      loaded = true;
      AsyncStorage.getItem(STORE_KEY)
        .then((raw) => {
          const saved = raw ? (JSON.parse(raw) as Partial<Spot>) : null;
          if (saved && (saved.side === 'left' || saved.side === 'right') && Number.isFinite(saved.up)) {
            spot = { side: saved.side, up: saved.up as number };
            place(spot);
          }
        })
        .catch(() => {});
    }, [place]),
  );

  const open = () => router.push('/assistant' as Href);
  const grab = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const pan = usePanGesture({
    minDistance: 6,
    onBegin: () => {
      startX.value = x.value;
      startY.value = y.value;
    },
    onActivate: () => {
      lifted.value = withSpring(1.08, SPRING);
      runOnJS(grab)();
    },
    onUpdate: (e) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value is its API, not React state.
      x.value = Math.min(0, Math.max(-maxLeft, startX.value + e.translationX));
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value is its API, not React state.
      y.value = Math.min(0, Math.max(-maxUp, startY.value + e.translationY));
    },
    onDeactivate: (e) => {
      // To the side she was thrown towards, or else the nearer one.
      const toLeft = Math.abs(e.velocityX) > 500 ? e.velocityX < 0 : x.value < -maxLeft / 2;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: assigning .value is its API, not React state.
      x.value = withSpring(toLeft ? -maxLeft : 0, SPRING);
      lifted.value = withSpring(1, SPRING);
      runOnJS(remember)({ side: toLeft ? 'left' : 'right', up: -y.value });
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      runOnJS(open)();
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: lifted.value }],
  }));

  if (!AI_CHAT_ENABLED || IS_WEB) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.button, { bottom, right }, moving]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('era.name')}, ${t('era.cta')}`}
        accessibilityHint={t('era.dragHint')}
        onAccessibilityTap={open}>
        <EraAvatar size={SIZE} />
        <View style={styles.online} />
      </Animated.View>
    </GestureDetector>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      width: BOX,
      height: BOX,
      borderRadius: BOX / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...Shadows.nav,
    },
    online: {
      position: 'absolute',
      right: 4,
      bottom: 5,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#22a55a',
      borderWidth: 2.5,
      borderColor: colors.surface,
    },
  });
