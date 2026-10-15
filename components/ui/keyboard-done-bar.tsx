import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * A "Done" bar attached to the top of the iOS keyboard.
 *
 * iOS gives a multi-line field a return key that inserts a new line, and the
 * number and phone keypads have no return key at all, so once one of those is
 * open there is no obvious way to close it. Owners writing a listing
 * description got stuck there. Android does not need it: its keyboards have
 * their own hide key and the system back gesture.
 *
 * Render it once per screen and give each input on that screen the same id:
 *
 *   <KeyboardDoneBar nativeID={KEYBOARD_DONE_ID} />
 *   <TextInput inputAccessoryViewID={KEYBOARD_DONE_ID} ... />
 *
 * The bar is part of the keyboard frame, so KeyboardAvoidingView makes room
 * for it and it never covers the screen's own content.
 */
export const KEYBOARD_DONE_ID = 'keyboard-done';
/** For inputs inside a Modal (a separate native window): render a second bar
 *  inside the modal with this id. */
export const KEYBOARD_DONE_SHEET_ID = 'keyboard-done-sheet';

export function KeyboardDoneBar({ nativeID = KEYBOARD_DONE_ID }: { nativeID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <Pressable
          onPress={Keyboard.dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.label}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.primaryLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    button: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
    },
    pressed: {
      opacity: 0.6,
    },
    label: {
      fontSize: 16,
      fontFamily: Fonts.sansBold,
      color: colors.accent,
    },
  });
