import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useFilters } from '@/contexts/filters-context';
import { getPropertiesCount } from '@/data/properties';
import { Property, PropertySort } from '@/data/types';
// Shared with the web app rather than duplicated — the same convention i18n
// already uses to pull locales out of src/.
import LOCATIONS from '@/src/features/properties/data/locations';

type PropertyType = NonNullable<Property['property_type']>;
type ListingType = NonNullable<Property['listing_type']>;

const PROPERTY_TYPES: PropertyType[] = [
  'apartment',
  'villa',
  'house',
  'land',
  'office',
];
const LISTING_TYPES: ListingType[] = ['sale', 'rent'];
const COUNT_OPTIONS = [1, 2, 3, 4];
const SORTS: PropertySort[] = ['newest', 'price_asc', 'price_desc'];

const CITIES: string[] = (LOCATIONS as { city: string }[]).map((l) => l.city);

/** Numeric text -> filter value. Empty string clears the facet. */
function toNumber(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radii, fonts } = useFhoTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radii.pill,
          borderColor: active ? colors.orange1 : colors.borderStrong,
          backgroundColor: active ? colors.orange1 : colors.surface2,
        },
      ]}>
      <Text style={[styles.chipText, { fontFamily: fonts.sansSemiBold, color: active ? '#fff' : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors, fonts } = useFhoTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { fontFamily: fonts.mono, color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export function FilterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { filters, queryFilters, setFilter, reset, priceInvalid, areaInvalid } =
    useFilters();
  const [count, setCount] = useState<number | null>(null);

  // Live count for the CTA. Runs off queryFilters so it's already debounced,
  // and only while the sheet is open.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    getPropertiesCount(queryFilters)
      .then((n) => {
        if (active) setCount(n);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [visible, queryFilters]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: fonts.serif, color: colors.text }]}>
            {t('search.filtersTitle')}
          </Text>
          <Pressable onPress={reset} hitSlop={12}>
            <Text style={[styles.resetText, { fontFamily: fonts.sansSemiBold, color: colors.orange1 }]}>
              {t('search.reset')}
            </Text>
          </Pressable>
        </View>

        {/* Price/area fields below use the number pad, which has no "Done"
            button on iOS — without this, the keyboard can sit over the CTA
            or the field itself with no way to see either. Wraps the CTA too
            so it rises with the content instead of staying pinned under the
            keyboard. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <Section label={t('search.listingType')}>
            <View style={styles.row}>
              <Chip
                label={t('common.all')}
                active={!filters.listingType}
                onPress={() => setFilter('listingType', null)}
              />
              {LISTING_TYPES.map((lt) => (
                <Chip
                  key={lt}
                  label={t(`search.${lt}`)}
                  active={filters.listingType === lt}
                  onPress={() => setFilter('listingType', lt)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.typology')}>
            <View style={styles.row}>
              <Chip
                label={t('common.all')}
                active={!filters.propertyType}
                onPress={() => setFilter('propertyType', null)}
              />
              {PROPERTY_TYPES.map((pt) => (
                <Chip
                  key={pt}
                  label={t(`search.${pt}`)}
                  active={filters.propertyType === pt}
                  onPress={() => setFilter('propertyType', pt)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.city')}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rowScroll}>
              <Chip
                label={t('search.anyCity')}
                active={!filters.city}
                onPress={() => setFilter('city', null)}
              />
              {CITIES.map((city) => (
                <Chip
                  key={city}
                  label={city}
                  active={filters.city === city}
                  onPress={() => setFilter('city', city)}
                />
              ))}
            </ScrollView>
          </Section>

          <Section label={t('search.priceRange')}>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { borderRadius: radii.md, borderColor: colors.borderStrong, backgroundColor: colors.surface2, color: colors.text, fontFamily: fonts.sans }]}
                keyboardType="number-pad"
                placeholder={t('search.minPrice')}
                placeholderTextColor={colors.textFaint}
                value={filters.minPrice?.toString() ?? ''}
                onChangeText={(v) => setFilter('minPrice', toNumber(v))}
              />
              <Text style={[styles.dash, { color: colors.textMuted }]}>—</Text>
              <TextInput
                style={[styles.input, { borderRadius: radii.md, borderColor: colors.borderStrong, backgroundColor: colors.surface2, color: colors.text, fontFamily: fonts.sans }]}
                keyboardType="number-pad"
                placeholder={t('search.maxPrice')}
                placeholderTextColor={colors.textFaint}
                value={filters.maxPrice?.toString() ?? ''}
                onChangeText={(v) => setFilter('maxPrice', toNumber(v))}
              />
            </View>
            {priceInvalid && (
              <Text style={[styles.warning, { fontFamily: fonts.sans, color: colors.statusSold }]}>{t('search.rangeInvalid')}</Text>
            )}
          </Section>

          <Section label={t('search.surface')}>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { borderRadius: radii.md, borderColor: colors.borderStrong, backgroundColor: colors.surface2, color: colors.text, fontFamily: fonts.sans }]}
                keyboardType="number-pad"
                placeholder={t('search.minArea')}
                placeholderTextColor={colors.textFaint}
                value={filters.minArea?.toString() ?? ''}
                onChangeText={(v) => setFilter('minArea', toNumber(v))}
              />
              <Text style={[styles.dash, { color: colors.textMuted }]}>—</Text>
              <TextInput
                style={[styles.input, { borderRadius: radii.md, borderColor: colors.borderStrong, backgroundColor: colors.surface2, color: colors.text, fontFamily: fonts.sans }]}
                keyboardType="number-pad"
                placeholder={t('search.maxArea')}
                placeholderTextColor={colors.textFaint}
                value={filters.maxArea?.toString() ?? ''}
                onChangeText={(v) => setFilter('maxArea', toNumber(v))}
              />
            </View>
            {areaInvalid && (
              <Text style={[styles.warning, { fontFamily: fonts.sans, color: colors.statusSold }]}>{t('search.rangeInvalid')}</Text>
            )}
          </Section>

          <Section label={t('search.bedrooms')}>
            <View style={styles.row}>
              <Chip
                label={t('search.anyBeds')}
                active={filters.beds == null}
                onPress={() => setFilter('beds', null)}
              />
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={n === 4 ? '4+' : String(n)}
                  active={filters.beds === n}
                  onPress={() => setFilter('beds', n)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.bathrooms')}>
            <View style={styles.row}>
              <Chip
                label={t('search.anyBaths')}
                active={filters.baths == null}
                onPress={() => setFilter('baths', null)}
              />
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={n === 4 ? '4+' : String(n)}
                  active={filters.baths === n}
                  onPress={() => setFilter('baths', n)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.sortLabel')}>
            <View style={styles.row}>
              {SORTS.map((s) => (
                <Chip
                  key={s}
                  label={t(`search.sort.${s}`)}
                  active={(filters.sort ?? 'newest') === s}
                  onPress={() => setFilter('sort', s)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        <Pressable
          style={[styles.cta, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}
          onPress={onClose}>
          <Text style={[styles.ctaText, { fontFamily: fonts.sansBold }]}>
            {count == null
              ? t('common.loading')
              : t('search.showHomes', { count })}
          </Text>
        </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
  },
  resetText: {
    fontSize: 15,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  dash: {},
  warning: {
    marginTop: 8,
    fontSize: 12,
  },
  cta: {
    margin: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    color: '#fff',
  },
});
