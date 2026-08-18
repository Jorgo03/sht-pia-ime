import { useMemo, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export const OTP_LENGTH = 6;

/**
 * Six discrete code boxes — the RN port of web's `.otp-inputs` / `.otp-digit`
 * (src/styles/profile.css). Same behaviours: type to auto-advance, Backspace
 * on an empty box steps back, pasting the whole code fills every box, and the
 * set turns red together on a rejected code.
 *
 * The boxes always sit on the dark DuskHero art in both app themes, so — like
 * web — the idle/filled/error colours are deliberately theme-independent
 * rather than pulled from the palette's text/border tokens.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error = false,
  editable = true,
  autoFocus = true,
}: {
  /** The code so far, 0–6 characters. */
  value: string;
  onChange: (code: string) => void;
  /** Fired once the sixth digit lands — the caller verifies immediately, with
   *  no submit button, same as web. Receives the code because `value` state
   *  hasn't flushed yet at this point. */
  onComplete?: (code: string) => void;
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const refs = useRef<(TextInput | null)[]>([]);

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    onChange(next);
    if (next.length === OTP_LENGTH) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;

    // A soft-keyboard paste (or autofill of an SMS/email code) arrives as one
    // multi-character change on a single box — spread it across the rest
    // rather than keeping only the first digit.
    if (clean.length > 1) {
      const next = (value.slice(0, index) + clean).slice(0, OTP_LENGTH);
      commit(next);
      const focus = Math.min(next.length, OTP_LENGTH - 1);
      refs.current[focus]?.focus();
      return;
    }

    const chars = digits.slice();
    chars[index] = clean;
    const next = chars.join('').slice(0, OTP_LENGTH);
    commit(next);
    if (index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (digits[index]) {
      const chars = digits.slice();
      chars[index] = '';
      onChange(chars.join('').replace(/\s/g, ''));
      return;
    }
    // Empty box — clear the previous one and step back, matching web's
    // handleOtpKeyDown.
    if (index > 0) {
      const chars = digits.slice();
      chars[index - 1] = '';
      onChange(chars.join(''));
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={[styles.box, !!digit && styles.boxFilled, error && styles.boxError]}
          value={digit}
          onChangeText={(raw) => handleChange(i, raw)}
          onKeyPress={(e) => handleKeyPress(i, e)}
          keyboardType="number-pad"
          inputMode="numeric"
          // iOS surfaces the emailed code above the keyboard with this set.
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          // Not maxLength={1}: that would silently truncate a pasted code
          // before handleChange ever sees the rest of it.
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          editable={editable}
          autoFocus={autoFocus && i === 0}
          accessibilityLabel={`Digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginVertical: 8,
    },
    box: {
      width: 44,
      height: 52,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.38)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      color: colors.cream100,
      fontFamily: Fonts?.sansBold,
      fontSize: 22,
      textAlign: 'center',
      padding: 0,
    },
    boxFilled: {
      borderColor: colors.accentLight,
      backgroundColor: 'rgba(255,125,26,0.16)',
    },
    boxError: {
      borderColor: '#ff5c5c',
      backgroundColor: 'rgba(255,92,92,0.14)',
    },
  });
