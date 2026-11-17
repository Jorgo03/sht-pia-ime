import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SelectField } from '@/components/ui/select-field';
import { useAppDimensions } from '@/hooks/use-app-dimensions';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import type { Property, PropertyFilters, PropertySort } from '@/data/types';
import { usePropertiesCountQuery } from '@/hooks/use-property-queries';
import LOCATIONS from '@/src/features/properties/data/locations';
import { AMENITIES, toggleAmenity } from '@/src/features/properties/lib/amenities';
import { cityLabel, findCity, orderCities } from '@/src/features/properties/lib/places';
import { normalizeRef } from '@/src/features/properties/lib/searchFilters';

type PropertyType = NonNullable<Property['property_type']>;
type Icon = ComponentProps<typeof MaterialIcons>['name'];

const TYPES: { value: PropertyType; icon: Icon }[] = [
  { value: 'apartment', icon: 'apartment' },
  { value: 'villa', icon: 'villa' },
  { value: 'house', icon: 'house' },
  { value: 'land', icon: 'landscape' },
  { value: 'office', icon: 'business' },
];
const CITIES: string[] = orderCities((LOCATIONS as { city: string }[]).map((l) => l.city));
const COUNTS = ['1', '2', '3', '4'];
export const SORTS: PropertySort[] = ['newest', 'price_asc', 'price_desc'];

const toNumber = (text: string): number | null => {
  const digits = text.replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
};

/**
 * The website's search filters as one wide panel above the results (owner's
 * reference, 2026-11-17): a title with "clear all", the map and the result
 * count; the active filters as removable chips; the property types as tiles;
 * then the other filters in rows of fields. The same filters as the phone's
 * sheet (filters-context), applied as they change. Website, tablet and up.
 */
export function FilterPanel({ viewMode, onViewMode, onShowResults, search, onSearch }: {
  /** The free-text search (city or area), Explore's own debounced field. */
  search: string;
  onSearch: (text: string) => void;
  viewMode: 'list' | 'map';
  onViewMode: (mode: 'list' | 'map') => void;
  onShowResults: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { filters, queryFilters, setFilter, reset, priceInvalid, areaInvalid } = useFilters();
  const { data: count } = usePropertiesCountQuery(queryFilters, true);
  const [more, setMore] = useState((filters.features?.length ?? 0) > 0);
  const zones = findCity(filters.city)?.zones ?? [];
  // Ten fields: five a row on a wide page, two on a tablet, never a ragged row.
  const { width } = useAppDimensions();
  const colStyle = { flexBasis: width >= 1100 ? '18%' : '46%' } as const;
  // The keyword box takes two places on a wide page, so nine fields fill
  // two even rows (and a whole row on a tablet).
  const keywordStyle = { flexBasis: width >= 1100 ? '37%' : '100%' } as const;

  const chips = activeChips(filters, t);
  const selectStyle = styles.select;

  const numberField = (key: 'minPrice' | 'maxPrice' | 'minArea' | 'maxArea', icon: Icon, label: string, unit?: string) => (
    <View style={[styles.field, colStyle]}>
      <MaterialIcons name={icon} size={16} color={colors.textSecondary} />
      <TextInput
        style={styles.input}
        inputMode="numeric"
        placeholder={label}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        value={filters[key]?.toString() ?? ''}
        onChangeText={(v) => setFilter(key, toNumber(v))}
      />
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );

  return (
    <View style={styles.panel} accessibilityRole="search" accessibilityLabel={t('search.panel.title')}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">{t('search.panel.title')}</Text>
        <View style={styles.headActions}>
          <Pressable accessibilityRole="button" onPress={reset} style={styles.linkButton} hitSlop={6}>
            <Text style={styles.linkText}>{t('search.panel.clearAll')}</Text>
            <MaterialIcons name="restart-alt" size={18} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewMode(viewMode === 'map' ? 'list' : 'map')}
            style={styles.outlineButton}>
            <MaterialIcons name={viewMode === 'map' ? 'grid-view' : 'map'} size={17} color={colors.textSecondary} />
            <Text style={styles.outlineText}>{viewMode === 'map' ? t('search.panel.showList') : t('search.panel.showOnMap')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onShowResults} style={[styles.primaryButton, { backgroundColor: colors.accentEnd }]}>
            <Text style={styles.primaryText}>{count != null ? t('search.showHomes', { count }) : t('search.showHomesAny')}</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={t('search.panel.removeFilter', { name: c.label })}
              onPress={() => c.clear(setFilter)}
              style={styles.chip}>
              <Text style={styles.chipText}>{c.label}</Text>
              <MaterialIcons name="close" size={14} color={colors.textPrimary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>{t('search.typology')}</Text>
      <View style={styles.tiles}>
        {TYPES.map((type) => {
          const active = filters.propertyType === type.value;
          return (
            <Pressable
              key={type.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter('propertyType', active ? null : type.value)}
              style={[styles.tile, active && styles.tileActive]}>
              <MaterialIcons name={type.icon} size={22} color={active ? colors.accentText : colors.textSecondary} />
              <Text style={[styles.tileText, active && styles.tileTextActive]}>{t(`search.${type.value}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{t('search.panel.otherFilters')}</Text>
      <View style={styles.grid}>
        {/* "ID / keyword": a listing reference (SH-…) finds that listing;
            anything else searches by city or area, like the phone's box. */}
        <View style={[styles.field, keywordStyle]}>
          <MaterialIcons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            autoCorrect={false}
            placeholder={t('search.panel.refPlaceholder')}
            accessibilityLabel={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={filters.refCode ?? search}
            onChangeText={(v) => {
              if (normalizeRef(v)) {
                setFilter('refCode', v);
                onSearch('');
              } else {
                if (filters.refCode) setFilter('refCode', null);
                onSearch(v);
              }
            }}
          />
        </View>
        <View style={[styles.cell, colStyle]}>
          <SelectField
            value={filters.city ?? ''}
            placeholder={t('search.anyCity')}
            icon="location-city"
            style={selectStyle}
            accessibilityLabel={t('search.city')}
            options={[
              { value: '', label: t('search.anyCity') },
              ...CITIES.map((city) => ({ value: city, label: cityLabel(city), keys: findCity(city)?.keys ?? [] })),
            ]}
            searchable
            onChange={(v) => {
              setFilter('city', v || null);
              setFilter('zone', null);
            }}
          />
        </View>
        <View style={[styles.cell, colStyle]}>
          <SelectField
            value={filters.zone ?? ''}
            placeholder={t('search.anyZone')}
            icon="place"
            style={selectStyle}
            accessibilityLabel={t('search.zone')}
            options={[{ value: '', label: t('search.anyZone') }, ...zones.map((z) => ({ value: z.name, label: z.name, keys: z.keys }))]}
            searchable
            onChange={(v) => setFilter('zone', v || null)}
          />
        </View>
        <View style={[styles.cell, colStyle]}>
          <SelectField
            value={filters.beds != null ? String(filters.beds) : ''}
            placeholder={t('search.bedrooms')}
            icon="bed"
            style={selectStyle}
            accessibilityLabel={t('search.bedrooms')}
            options={[{ value: '', label: `${t('search.bedrooms')}: ${t('search.anyBeds')}` }, ...COUNTS.map((n) => ({ value: n, label: `${t('search.bedrooms')}: ${n === '4' ? '4+' : n}` }))]}
            onChange={(v) => setFilter('beds', v ? Number(v) : null)}
          />
        </View>
        {numberField('minPrice', 'euro-symbol', t('search.minPrice'))}
        {numberField('maxPrice', 'euro-symbol', t('search.maxPrice'))}
        {numberField('minArea', 'open-in-full', t('search.minArea'), 'm²')}
        {numberField('maxArea', 'open-in-full', t('search.maxArea'), 'm²')}
        <View style={[styles.cell, colStyle]}>
          <SelectField
            value={filters.baths != null ? String(filters.baths) : ''}
            placeholder={t('search.bathrooms')}
            icon="bathtub"
            style={selectStyle}
            accessibilityLabel={t('search.bathrooms')}
            options={[{ value: '', label: `${t('search.bathrooms')}: ${t('search.anyBaths')}` }, ...COUNTS.map((n) => ({ value: n, label: `${t('search.bathrooms')}: ${n === '4' ? '4+' : n}` }))]}
            onChange={(v) => setFilter('baths', v ? Number(v) : null)}
          />
        </View>
      </View>
      {priceInvalid || areaInvalid ? <Text style={styles.warning}>{t('search.rangeInvalid')}</Text> : null}

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={styles.moreToggle}>
        <Text style={styles.moreText}>{more ? t('search.panel.fewerFilters') : t('search.panel.moreFilters')}</Text>
        <MaterialIcons name={more ? 'expand-less' : 'expand-more'} size={18} color={colors.accentText} />
      </Pressable>
      {more ? (
        <View style={styles.chipRow}>
          {AMENITIES.map((amenity) => {
            const on = filters.features?.includes(amenity) ?? false;
            return (
              <Pressable
                key={amenity}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter('features', toggleAmenity(filters.features, amenity), { immediate: true })}
                style={[styles.amenity, on && styles.tileActive]}>
                <Text style={[styles.tileText, on && styles.tileTextActive]}>{t(`listing.feature.${amenity}`, amenity)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

type SetFilter = ReturnType<typeof useFilters>['setFilter'];
type Translate = ReturnType<typeof useTranslation>['t'];

/** The filters in effect, each with a label and how to clear it. */
function activeChips(f: PropertyFilters, t: Translate): { key: string; label: string; clear: (set: SetFilter) => void }[] {
  const out: { key: string; label: string; clear: (set: SetFilter) => void }[] = [];
  if (f.listingType) out.push({ key: 'lt', label: t(`search.${f.listingType}`), clear: (s) => s('listingType', null) });
  if (f.propertyType) out.push({ key: 'pt', label: t(`search.${f.propertyType}`, { defaultValue: f.propertyType }), clear: (s) => s('propertyType', null) });
  if (f.city) out.push({ key: 'city', label: cityLabel(f.city), clear: (s) => { s('city', null); s('zone', null); } });
  if (f.zone) out.push({ key: 'zone', label: f.zone, clear: (s) => s('zone', null) });
  if (f.refCode) out.push({ key: 'ref', label: f.refCode, clear: (s) => s('refCode', null) });
  if (f.minPrice != null || f.maxPrice != null) {
    out.push({ key: 'price', label: `€ ${f.minPrice ?? 0} – ${f.maxPrice ?? '∞'}`, clear: (s) => { s('minPrice', null); s('maxPrice', null); } });
  }
  if (f.minArea != null || f.maxArea != null) {
    out.push({ key: 'area', label: `${f.minArea ?? 0} – ${f.maxArea ?? '∞'} m²`, clear: (s) => { s('minArea', null); s('maxArea', null); } });
  }
  if (f.beds != null) out.push({ key: 'beds', label: `${t('search.bedrooms')}: ${f.beds}${f.beds >= 4 ? '+' : ''}`, clear: (s) => s('beds', null) });
  if (f.baths != null) out.push({ key: 'baths', label: `${t('search.bathrooms')}: ${f.baths}${f.baths >= 4 ? '+' : ''}`, clear: (s) => s('baths', null) });
  for (const a of f.features ?? []) {
    out.push({ key: `f-${a}`, label: t(`listing.feature.${a}`, a), clear: (s) => s('features', toggleAmenity(f.features, a), { immediate: true }) });
  }
  return out;
}

/** "Showing 12 of 2,789 results", the sort and the view, above the grid. */
export function ResultsBar({ shown, total, tabs }: { shown: number; total: number; tabs?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { filters, setFilter } = useFilters();
  const n = (v: number) => v.toLocaleString(i18n.language);
  const selectStyle = styles.select;
  return (
    <View style={styles.resultsBar}>
      <Text style={styles.resultsText} accessibilityLiveRegion="polite">
        {t('search.panel.results', { shown: n(shown), total: n(total) })}
      </Text>
      <View style={styles.resultsRight}>
      {tabs}
      <View style={styles.sortCell}>
        <SelectField
          value={filters.sort ?? 'newest'}
          placeholder={t('search.sortLabel')}
          icon="sort"
          style={selectStyle}
          accessibilityLabel={t('search.sortLabel')}
          options={SORTS.map((s) => ({ value: s, label: t(`search.sort.${s}`) }))}
          onChange={(v) => setFilter('sort', v as PropertySort)}
        />
      </View>
      </View>
    </View>
  );
}

const createStyles = (c: AtticoPalette) =>
  StyleSheet.create({
    select: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.primary },
    panel: {
      marginTop: 18,
      backgroundColor: c.primaryLight,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 24,
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
    title: { fontFamily: Fonts.serif, fontSize: 30, color: c.textPrimary },
    headActions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 6 },
    linkText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: c.textPrimary },
    outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    outlineText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: c.textSecondary },
    primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 18, borderRadius: 12 },
    primaryText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.accentTint },
    chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: c.textPrimary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    sectionLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: c.textPrimary },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.primary,
    },
    tileActive: { borderColor: c.accent, backgroundColor: c.accentTint },
    tileText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: c.textPrimary },
    tileTextActive: { color: c.accentText },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    cell: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
    field: {
      flexGrow: 1,
      flexBasis: 180,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.primary,
    },
    input: { flex: 1, minWidth: 0, fontFamily: Fonts.sans, fontSize: 14, color: c.textPrimary, paddingVertical: 12 },
    unit: { fontFamily: Fonts.sans, fontSize: 13, color: c.textSecondary },
    warning: { fontFamily: Fonts.sans, fontSize: 13, color: c.accentText },
    moreToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 36 },
    moreText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: c.accentText },
    amenity: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.primary },
    resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 28, marginBottom: 16 },
    resultsText: { fontFamily: Fonts.sansSemiBold, fontSize: 18, color: c.textPrimary },
    resultsRight: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
    sortCell: { width: 240, maxWidth: '100%' },
  });
