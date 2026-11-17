import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';

import type { DateFieldProps } from './date-field.types';

/**
 * One date for the report's custom period. iOS shows its compact date button
 * in place; Android's picker is a dialog, opened from a field that shows the
 * date. See date-field.web.tsx for the website.
 */
export function DateField({ label, value, onChange, maximumDate }: DateFieldProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          maximumDate={maximumDate}
          onChange={(_e, date) => date && onChange(date)}
          themeVariant={theme === 'dark' ? 'dark' : 'light'}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${formatDate(value.toISOString())}`}>
        <Text style={styles.value}>{formatDate(value.toISOString())}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={maximumDate}
          onChange={(_e, date) => {
            setOpen(false);
            if (date) onChange(date);
          }}
        />
      )}
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
    field: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    value: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
  });
