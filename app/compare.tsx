import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useCompare } from '@/contexts/compare-context';
import { useTheme } from '@/contexts/theme-context';
import { type CompareHome } from '@/data/properties';
import { useComparePropertiesQuery } from '@/hooks/use-property-queries';
import { useReadableColumn } from '@/hooks/use-responsive';
import { formatPrice, getLocalizedText, priceSuffixKey } from '@/lib/format';
import { cardImageUrl } from '@/lib/image';
import { allFeatures, bestOf, MAX_COMPARE, pricePerM2 } from '@/src/features/properties/lib/compare';

type Cell = { key: string; text: string; badge?: string | null };

export default function CompareScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const insets = useSafeAreaInsets();
  const { ids, toggle, keepOnly, clear } = useCompare();
  const { data, isLoading, isError, refetch } = useComparePropertiesQuery(ids);
  const homes = useMemo(() => data ?? [], [data]);

  // A home that has been sold or withdrawn no longer comes back.
  useEffect(() => {
    if (data) keepOnly(data.map((h) => h.id));
  }, [data, keepOnly]);

  const lang = i18n.language;
  const none = t('aiAssistant.notSpecified');
  const best = useMemo(() => bestOf(homes), [homes]);
  const features = useMemo(() => allFeatures(homes), [homes]);

  const browse = () => router.push('/(tabs)/explore' as Href);
  const cell = (home: CompareHome, text: string, wins: string | null, badge: string): Cell => ({
    key: home.id,
    text,
    badge: wins === home.id ? badge : null,
  });

  const showPerM2 = homes.some((h) => pricePerM2(h) != null);
  const rows: { key: string; label: string; cells: Cell[] }[] = [
    {
      key: 'price',
      label: t('aiAssistant.compare.price'),
      cells: homes.map((h) => {
        const suffix = priceSuffixKey(h.listing_type);
        return cell(h, `${formatPrice(h.price, lang, h.currency)}${suffix ? t(suffix) : ''}`, best.price, t('aiAssistant.compare.best.price'));
      }),
    },
    ...(showPerM2
      ? [{
          key: 'perM2',
          label: t('aiAssistant.compare.pricePerM2'),
          cells: homes.map((h) => {
            const value = pricePerM2(h);
            return cell(h, value == null ? none : formatPrice(value, lang, h.currency), best.perM2, t('aiAssistant.compare.best.perM2'));
          }),
        }]
      : []),
    { key: 'area', label: t('aiAssistant.compare.area'), cells: homes.map((h) => cell(h, h.sqft ? `${h.sqft} m²` : none, best.area, t('aiAssistant.compare.best.area'))) },
    { key: 'beds', label: t('aiAssistant.compare.bedrooms'), cells: homes.map((h) => cell(h, h.beds != null ? String(h.beds) : none, best.beds, t('aiAssistant.compare.best.beds'))) },
    { key: 'baths', label: t('aiAssistant.compare.bathrooms'), cells: homes.map((h) => ({ key: h.id, text: h.baths != null ? String(h.baths) : none })) },
    {
      key: 'floor',
      label: t('aiAssistant.compare.floor'),
      cells: homes.map((h) => ({
        key: h.id,
        text: h.floor == null ? none : h.total_floors ? t('aiAssistant.compare.floorOf', { floor: h.floor, total: h.total_floors }) : String(h.floor),
      })),
    },
    { key: 'year', label: t('compare.yearBuilt'), cells: homes.map((h) => ({ key: h.id, text: h.year_built ? String(h.year_built) : none })) },
    { key: 'type', label: t('compare.type'), cells: homes.map((h) => ({ key: h.id, text: h.property_type ? t(`search.${h.property_type}`, { defaultValue: h.property_type }) : none })) },
    { key: 'place', label: t('aiAssistant.compare.location'), cells: homes.map((h) => ({ key: h.id, text: [h.zone, h.city].filter(Boolean).join(', ') || none })) },
  ];

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <ScreenHero pre={t('compare.headlinePre')} em={t('compare.headlineEm')} />

        {ids.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="compare-arrows" size={34} color={colors.accentText} />
            </View>
            <Text style={styles.centerText}>{t('compare.empty')}</Text>
            <Text style={styles.centerHint}>{t('compare.emptyHint')}</Text>
            <ActionButton title={t('compare.browse')} onPress={browse} />
          </View>
        ) : isLoading ? (
          <View style={styles.skeletonRow}>
            {ids.map((id) => <View key={id} style={styles.skeleton} />)}
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.centerText} accessibilityLiveRegion="polite">{t('compare.loadFailed')}</Text>
            <ActionButton title={t('common.retry')} onPress={() => void refetch()} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
            <View style={styles.columns}>
              {homes.map((home) => {
                const title = getLocalizedText(home.title_i18n, lang) || home.title;
                return (
                  <View key={home.id} style={styles.column}>
                    <Pressable onPress={() => router.push(`/property/${home.id}` as Href)} accessibilityRole="link" accessibilityLabel={title}>
                      <View style={styles.photo}>
                        {home.image_urls?.[0] ? (
                          <Image accessibilityLabel={title} source={{ uri: cardImageUrl(home.image_urls[0], 180) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                        ) : (
                          <MaterialIcons name="image-not-supported" size={26} color={colors.textSecondary} />
                        )}
                      </View>
                      <Text style={styles.homeTitle} numberOfLines={3}>{title}</Text>
                    </Pressable>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${t('compare.remove')}: ${title}`}
                      style={styles.remove}
                      onPress={() => toggle(home.id)}
                      hitSlop={8}
                      activeOpacity={0.7}>
                      <MaterialIcons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {homes.length < MAX_COMPARE && (
                <View style={styles.column}>
                  <Pressable style={styles.addTile} onPress={browse} accessibilityRole="button" accessibilityLabel={t('compare.addAnother')}>
                    <MaterialIcons name="add" size={26} color={colors.accentText} />
                    <Text style={styles.addText}>{t('compare.addAnother')}</Text>
                  </Pressable>
                </View>
              )}
            </View>

              {rows.map((row) => (
                <View key={row.key} style={[styles.row, styles.rowDivider]}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <View style={styles.cells}>
                    {row.cells.map((c) => (
                      <View key={c.key} style={styles.cell}>
                        <Text style={[styles.value, !!c.badge && styles.valueBest]}>{c.text}</Text>
                        {c.badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{c.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                    {homes.length < MAX_COMPARE && <View style={styles.cell} />}
                  </View>
                </View>
              ))}
            </View>

            {features.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('aiAssistant.compare.amenities')}</Text>
                <View style={styles.card}>
                  {features.map((feature, i) => (
                    <View key={feature} style={[styles.row, i > 0 && styles.rowDivider]}>
                      <Text style={styles.rowLabel}>{t(`listing.feature.${feature}`, { defaultValue: feature })}</Text>
                      <View style={styles.cells}>
                        {homes.map((home) => {
                          const has = home.features?.includes(feature);
                          return (
                            <View key={home.id} style={styles.cell}>
                              <MaterialIcons
                                name={has ? 'check-circle' : 'remove'}
                                size={20}
                                color={has ? colors.accentText : colors.textSecondary}
                                accessibilityLabel={has ? t('compare.yes') : t('compare.no')}
                              />
                            </View>
                          );
                        })}
                        {homes.length < MAX_COMPARE && <View style={styles.cell} />}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity accessibilityRole="button" style={styles.clear} onPress={clear} activeOpacity={0.7}>
              <Text style={styles.clearText}>{t('compare.clear')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    centerText: { fontSize: 16, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary, textAlign: 'center' },
    centerHint: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
    skeletonRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
    skeleton: { flex: 1, height: 190, borderRadius: 16, backgroundColor: colors.glass },
    scroll: { paddingHorizontal: 20, gap: 14 },
    columns: { flexDirection: 'row', gap: 10, paddingVertical: 14 },
    column: { flex: 1, minWidth: 0 },
    photo: {
      aspectRatio: 1,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    homeTitle: { fontFamily: Fonts?.serif, fontSize: 14, lineHeight: 18, color: colors.textPrimary },
    remove: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(20,17,14,0.72)',
    },
    addTile: {
      aspectRatio: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 6,
    },
    addText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.accentText, textAlign: 'center' },
    sectionTitle: { fontFamily: Fonts?.serif, fontSize: 20, color: colors.textPrimary, marginTop: 6 },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 14,
    },
    row: { paddingVertical: 12, gap: 8 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    cells: { flexDirection: 'row', gap: 10 },
    cell: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 },
    value: { fontFamily: Fonts.sansSemiBold, fontSize: 14, lineHeight: 19, color: colors.textPrimary },
    valueBest: { color: colors.accentText },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.accentTint },
    badgeText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.accentText },
    clear: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
    clearText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textSecondary },
  });
