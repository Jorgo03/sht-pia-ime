import { createElement, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { ViewingTimePickerProps } from './viewing-time-picker.types';

/** "2026-10-27T17:30" in the visitor's own time zone, as datetime-local wants. */
function localValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Web sibling of viewing-time-picker.native.tsx. @react-native-community/
 * datetimepicker renders nothing on the web, so the viewing sheet showed
 * "When?" over an empty gap and every request went out for the default slot.
 * The browser's own date-time field is keyboard and screen-reader friendly,
 * and opens the phone's wheel picker on mobile browsers.
 */
export function ViewingTimePicker({ value, minimumDate, onChange }: ViewingTimePickerProps) {
  const { t } = useTranslation();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return createElement('input', {
    type: 'datetime-local',
    value: localValue(value),
    min: localValue(minimumDate),
    step: 900,
    'aria-label': t('viewings.when'),
    onChange: (e: { target: { value: string } }) => {
      const next = new Date(e.target.value);
      // Cleared or typed past the minimum: keep the last valid time.
      if (!Number.isNaN(next.getTime()) && next >= minimumDate) onChange(next);
    },
    style: StyleSheet.flatten([styles.input, { colorScheme: theme === 'dark' ? 'dark' : 'light' }]),
  });
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    input: {
      minHeight: 48,
      width: '100%',
      boxSizing: 'border-box',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      backgroundColor: colors.glass,
      paddingLeft: 16,
      paddingRight: 16,
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: colors.textPrimary,
    } as object,
  });
