import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Keyboard, Platform, Pressable, StyleSheet, Text, View, type KeyboardEvent } from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { keyboardLift } from '@/src/lib/keyboardLift';

/**
 * The orange "U krye" bar that sits on top of the software keyboard and
 * closes it (blurring the field; the typed value stays, nothing is submitted).
 *
 * Replaces an iOS InputAccessoryView: that did not appear above the
 * multi-line description or the number pads in Expo Go, did nothing on
 * Android, and every field had to opt in. This one follows the keyboard
 * itself, so every field on the screen gets it, of any keyboard type.
 *
 * Render it once as the LAST child of a screen's (or sheet's) full-height
 * container. It takes real space rather than floating over content, so the
 * focused field and the screen's own buttons stay visible above it:
 * - iOS does not shrink the screen for the keyboard; the bar measures how far
 *   the container's bottom sits below the keyboard's top and lifts itself by
 *   that much (0 inside a KeyboardAvoidingView, which already made room).
 * - Android resizes the window above the keyboard, so the bar sits at the
 *   bottom as it is.
 * - Web: nothing. Mobile browsers show their own close control.
 */
export function KeyboardDoneBar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const keyboardTop = useKeyboardTop();
  const sentinel = useRef<View>(null);
  const [lift, setLift] = useState(0);

  // Where the container's bottom is in the window, measured with a zero-height
  // view after the bar: it stays at the bottom however much the bar lifts.
  const measure = useCallback(() => {
    if (Platform.OS !== 'ios' || keyboardTop === null) return;
    sentinel.current?.measureInWindow((_x, y) => {
      setLift(keyboardLift({ containerBottom: y, keyboardTop }));
    });
  }, [keyboardTop]);

  useEffect(() => {
    measure();
  }, [measure]);

  if (Platform.OS === 'web' || keyboardTop === null) return null;

  return (
    <>
      <View style={[styles.bar, { marginBottom: lift }]}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          accessibilityHint={t('common.closeKeyboard')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <LinearGradient
            colors={[colors.accent, colors.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.label} maxFontSizeMultiplier={1.6}>
            {t('common.done')}
          </Text>
        </Pressable>
      </View>
      <View ref={sentinel} collapsable={false} onLayout={measure} style={styles.sentinel} />
    </>
  );
}

/** The keyboard's top edge in window coordinates while it is shown, else null. */
function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const onShow = (e: KeyboardEvent) => {
      const { screenY, height } = e.endCoordinates;
      // A zero-height frame (hardware keyboard, floating iPad keyboard moving
      // off screen) means there is nothing to sit on.
      if (!height) return setTop(null);
      setTop(ios ? screenY : Dimensions.get('window').height - height);
    };
    const onHide = () => setTop(null);
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
      ...(ios ? [Keyboard.addListener('keyboardWillChangeFrame', onShow)] : []),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return top;
}

/** The bar's height without any lift: 8 + 44 + 8. */
export const KEYBOARD_DONE_BAR_HEIGHT = 60;

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    bar: {
      minHeight: KEYBOARD_DONE_BAR_HEIGHT,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primaryLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    // Same gradient pill and label as PrimaryCTA, at a toolbar's 44pt height.
    button: {
      minHeight: 44,
      minWidth: 96,
      paddingHorizontal: 22,
      borderRadius: Radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    label: {
      fontFamily: Fonts.sansBold,
      fontSize: 16,
      color: '#fff',
    },
    sentinel: { height: 0 },
  });
