import { createElement, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { DateFieldProps } from './date-field.types';

/** "2026-10-27" in the visitor's own time zone, as a date input wants. */
function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Web sibling of date-field.native.tsx: the datetimepicker draws nothing on
 * the web, so the browser's own date field is used (keyboard and screen
 * reader friendly; the phone's wheel on mobile browsers).
 */
export function DateField({ label, value, onChange, maximumDate }: DateFieldProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        type: 'date',
        value: localDay(value),
        max: maximumDate ? localDay(maximumDate) : undefined,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => {
          const [y, m, d] = e.target.value.split('-').map(Number);
          // Cleared or half-typed: keep the last valid day.
          if (y && m && d) onChange(new Date(y, m - 1, d));
        },
        style: StyleSheet.flatten([styles.input, { colorScheme: theme === 'dark' ? 'dark' : 'light' }]),
      })}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    row: {
      flex: 1,
      minWidth: 120,
      gap: 6,
    },
    label: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12,
      color: colors.textSecondary,
    },
    input: {
      minHeight: 48,
      width: '100%',
      boxSizing: 'border-box',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      backgroundColor: colors.glass,
      paddingLeft: 14,
      paddingRight: 14,
      fontFamily: Fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    } as object,
  });
