import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Radii, Shadows, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Reusable bottom sheet (§17) — backdrop, sliding card, drag handle.
 *
 * This is the pattern filter-sheet.tsx worked out, extracted so the Add sheet,
 * filter sheet and sign-out confirmation share one implementation instead of
 * three. Two details are load-bearing and were bugs the first time round:
 *
 * 1. `height` is a definite pixel value, never `maxHeight: '%'`. On native
 *    Yoga a container sized only by maxHeight can leave `flex: 1` descendants
 *    with nothing to resolve against and collapse them to zero height — which
 *    renders fine under react-native-web and only breaks on device.
 * 2. The pan gesture is attached to the grip/header zone only, never the
 *    scrollable body, so dragging can't fight content scrolling.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  /** Fraction of screen height the sheet occupies. */
  heightRatio = 0.88,
  /** Drag distance past which release dismisses instead of springing back. */
  dismissThreshold = 120,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  heightRatio?: number;
  dismissThreshold?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * heightRatio);
  const styles = useMemo(() => createStyles(colors, sheetHeight), [colors, sheetHeight]);

  const translateY = useSharedValue(0);

  // Modal keeps this mounted across visibility toggles, so a prior
  // dismiss-drag would otherwise leave the sheet visually offset on reopen.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > dismissThreshold || e.velocityY > 800) {
        translateY.value = withTiming(sheetHeight, { duration: 200 }, () => {
          runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 300 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.gripZone}>
              <View style={styles.grip} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AtticoPalette, sheetHeight: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(10,8,6,0.45)',
    },
    sheet: {
      height: sheetHeight,
      borderTopLeftRadius: Radii['2xl'],
      borderTopRightRadius: Radii['2xl'],
      backgroundColor: colors.primary,
      ...Shadows.nav,
    },
    // Generous hit area around the 4px grip — the whole strip is draggable.
    gripZone: {
      paddingTop: 10,
      paddingBottom: 6,
      alignItems: 'center',
    },
    grip: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
    },
  });
