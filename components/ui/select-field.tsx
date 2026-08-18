import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * RN equivalent of web's `.filter-select` (src/styles/search.css) — a
 * bordered field with a leading icon and a trailing caret that opens a
 * scrollable option list. Web gets this for free from a native `<select>`;
 * RN has no such primitive, so this reproduces the same visual field plus a
 * sheet of options rather than falling back to a row of chips (which is what
 * the filter sheet used to do for City, and is a different control type from
 * the reference implementation).
 */
export function SelectField({
  value,
  options,
  placeholder,
  icon = 'place',
  onChange,
  accessibilityLabel,
}: {
  /** '' means "no selection" — renders `placeholder` in muted text. */
  value: string;
  options: SelectOption[];
  placeholder: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}>
        <MaterialIcons name={icon} size={15} color={colors.accent} />
        <Text style={[styles.value, !selected && styles.valueMuted]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={20} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value || '__any__'}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {active && <MaterialIcons name="check" size={18} color={colors.accent} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  // Matches web's .filter-select: 12px/14px padding, r-md radius,
  // surface-2 background, 1px border, accent-colored leading icon.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
  },
  value: {
    flex: 1,
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  // Web's select shows the muted placeholder until it holds a real value
  // (`.filter-bar__field select` vs `.has-value`).
  valueMuted: {
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.primaryLight,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  optionActive: {
    backgroundColor: colors.accentGlow,
  },
  optionText: {
    fontFamily: Fonts?.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextActive: {
    fontFamily: Fonts?.sansSemiBold,
    color: colors.accent,
  },
});
