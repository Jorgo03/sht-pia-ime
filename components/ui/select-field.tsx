import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Control, Fonts, Radii, type AtticoPalette, Site } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { IS_WEB, sheetColumn } from '@/constants/web-frame';
import { fold } from '@/src/features/properties/lib/places';

export interface SelectOption {
  value: string;
  label: string;
  /** Other names the search box matches ("tirana", "durazzo"); folded. */
  keys?: string[];
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
  variant = 'filter',
  style,
  searchable = false,
}: {
  /** '' means "no selection" — renders `placeholder` in muted text. */
  value: string;
  options: SelectOption[];
  placeholder: string;
  /** null: no leading icon (a short value like a currency code). */
  icon?: keyof typeof MaterialIcons.glyphMap | null;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  /** 'filter': web's compact .filter-select. 'form': the same box as Field
   *  (constants/theme Control), for selects that sit beside text fields. */
  variant?: 'filter' | 'form';
  style?: StyleProp<ViewStyle>;
  /** A search box above the options (long lists: 61 cities, a city's zones).
   *  Matches the start of any word of the label or of its keys, without
   *  diacritics. Picking is still the only way in: nothing typed is saved. */
  searchable?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const shown = useMemo(() => {
    const words = fold(query).split(' ').filter(Boolean);
    if (!searchable || !words.length) return options;
    return options.filter((o) => [fold(o.label), ...(o.keys ?? [])].some((k) => {
      const parts = k.split(' ');
      return words.every((w) => parts.some((p) => p.startsWith(w)));
    }));
  }, [options, query, searchable]);

  const selected = options.find((o) => o.value === value);
  const form = variant === 'form';

  return (
    <>
      <Pressable
        style={[styles.field, form && styles.fieldForm, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityValue={selected ? { text: selected.label } : undefined}>
        {icon ? (
          <MaterialIcons name={icon} size={form ? Control.iconSize : 15} color={form ? colors.textSecondary : colors.accent} />
        ) : null}
        <Text style={[styles.value, form && styles.valueForm, !selected && styles.valueMuted]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={20} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, sheetColumn]} onPress={(e) => e.stopPropagation()}>
            {searchable ? (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.search')}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={`${t('common.search')}: ${accessibilityLabel ?? placeholder}`}
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.search}
              />
            ) : null}
            <FlatList
              data={shown}
              ListEmptyComponent={searchable ? (
                <Text style={styles.empty} accessibilityLiveRegion="polite">{t('locations.noMatch')}</Text>
              ) : undefined}
              keyExtractor={(o) => o.value || '__any__'}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(item.value);
                      close();
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
    borderRadius: IS_WEB ? Site.control.radius : Radii.md,
  },
  // Field's box: same height, side padding and gap as a text field.
  fieldForm: {
    minHeight: Control.height,
    paddingVertical: 0,
    paddingHorizontal: Control.paddingHorizontal,
    gap: Control.gap,
  },
  value: {
    flex: 1,
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  // Field's text: 15 regular.
  valueForm: {
    fontFamily: Fonts?.sans,
    fontSize: 15,
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
    backgroundColor: colors.accentTint,
  },
  optionText: {
    fontFamily: Fonts?.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  search: {
    margin: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    fontFamily: Fonts?.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontFamily: Fonts?.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  optionTextActive: {
    fontFamily: Fonts?.sansSemiBold,
    color: colors.accentText,
  },
});
