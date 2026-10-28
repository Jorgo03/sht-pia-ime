import { useRouter, type Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatPrice } from '@/lib/format';
import type { Comparison, ComparisonItem } from '@/lib/assistant';

const COLUMN = 132;
const LABEL = 120;

/**
 * Listings side by side, from the numbers the server read from the database
 * (supabase/functions/ai-assistant/logic.js compareRows) — the model's text
 * never fills a cell. A missing value says so rather than showing a dash that
 * could be read as "none".
 */
function ComparisonTableBase({ comparison }: { comparison: Comparison }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lang = i18n.language;
  const none = t('aiAssistant.notSpecified');

  const money = (value: number | null, currency: string) => (value == null ? none : formatPrice(value, lang, currency));
  const rows: { key: string; label: string; cell: (i: ComparisonItem) => string; best?: string | null }[] = [
    {
      key: 'price',
      label: t('aiAssistant.compare.price'),
      cell: (i) => money(i.price, i.currency) + (comparison.mixed_currencies && i.currency !== 'EUR' && i.price_eur_approx ? `\n≈ ${formatPrice(i.price_eur_approx, lang, 'EUR')}` : ''),
      best: comparison.best.lowest_price,
    },
    {
      key: 'perM2',
      label: t('aiAssistant.compare.pricePerM2'),
      cell: (i) =>
        comparison.mixed_currencies
          ? i.price_per_m2_eur_approx == null ? none : `≈ ${formatPrice(i.price_per_m2_eur_approx, lang, 'EUR')}`
          : money(i.price_per_m2, i.currency),
      best: comparison.best.lowest_price_per_m2,
    },
    { key: 'area', label: t('aiAssistant.compare.area'), cell: (i) => (i.area_m2 == null ? none : `${i.area_m2} m²`), best: comparison.best.largest_area },
    { key: 'beds', label: t('aiAssistant.compare.bedrooms'), cell: (i) => (i.bedrooms == null ? none : String(i.bedrooms)), best: comparison.best.most_bedrooms },
    { key: 'baths', label: t('aiAssistant.compare.bathrooms'), cell: (i) => (i.bathrooms == null ? none : String(i.bathrooms)) },
    {
      key: 'floor',
      label: t('aiAssistant.compare.floor'),
      cell: (i) =>
        i.floor == null ? none : i.building_floors ? t('aiAssistant.compare.floorOf', { floor: i.floor, total: i.building_floors }) : String(i.floor),
    },
    { key: 'place', label: t('aiAssistant.compare.location'), cell: (i) => [i.zone, i.city].filter(Boolean).join(', ') || none },
    {
      key: 'features',
      label: t('aiAssistant.compare.amenities'),
      cell: (i) => (i.features.length ? i.features.map((f) => t(`listing.feature.${f}`, f)).join(', ') : none),
    },
  ];

  return (
    <View style={styles.wrap} accessibilityLabel={t('aiAssistant.compare.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View>
          <View style={styles.row}>
            <View style={[styles.labelCell, styles.headCell]} />
            {comparison.items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.cell, styles.headCell]}
                onPress={() => router.push(`/property/${item.id}` as Href)}
                accessibilityRole="link"
                accessibilityLabel={item.title}>
                <Text style={styles.headText} numberOfLines={3}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.labelCell}>
                <Text style={styles.labelText}>{row.label}</Text>
              </View>
              {comparison.items.map((item) => {
                const best = row.best === item.id;
                return (
                  <View key={item.id} style={[styles.cell, best && styles.bestCell]}>
                    <Text style={[styles.cellText, best && styles.bestText]}>{row.cell(item)}</Text>
                    {best ? <Text style={styles.bestBadge}>{t(`aiAssistant.compare.best.${row.key}`)}</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.note}>
        {comparison.mixed_currencies ? `${t('aiAssistant.compare.mixedCurrencies')} ` : ''}
        {t('aiAssistant.compare.areaNote')}
      </Text>
    </View>
  );
}

export const ComparisonTable = memo(ComparisonTableBase);

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    wrap: {
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      overflow: 'hidden',
    },
    scroll: { paddingBottom: Spacing.xs },
    row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    labelCell: { width: LABEL, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
    headCell: { paddingTop: 10 },
    cell: { width: COLUMN, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
    headText: { fontFamily: Fonts.sansBold, fontSize: 12, lineHeight: 16, color: colors.accentText },
    labelText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
    cellText: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
    bestCell: { backgroundColor: colors.accentTint },
    bestText: { fontFamily: Fonts.sansBold },
    bestBadge: { marginTop: 2, fontFamily: Fonts.sansSemiBold, fontSize: 10, color: colors.accentText },
    note: { paddingHorizontal: 10, paddingVertical: 8, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 15, color: colors.textSecondary },
  });
