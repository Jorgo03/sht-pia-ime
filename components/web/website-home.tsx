import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CityRail } from '@/components/home/city-rail';
import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { SiteFooter } from '@/components/web/site-footer';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { useAppDimensions } from '@/hooks/use-app-dimensions';
import { useAgentDirectoryQuery, useCityTilesQuery, usePropertiesCountQuery, usePropertiesQuery } from '@/hooks/use-property-queries';

type IconName = keyof typeof MaterialIcons.glyphMap;

const FEATURED_COUNT = 8;

const STEPS = ['search', 'compare', 'visit', 'buy'] as const;

const SERVICES: { key: string; icon: IconName; href: string }[] = [
  { key: 'wanted', icon: 'person-search', href: '/wanted' },
  { key: 'priceHistory', icon: 'trending-down', href: '/explore' },
  { key: 'currency', icon: 'currency-exchange', href: '/explore' },
  { key: 'viewings', icon: 'event-available', href: '/explore' },
  { key: 'chat', icon: 'forum', href: '/explore' },
  { key: 'guide', icon: 'flight-land', href: '/guide' },
];

/**
 * The website's Home (DECISIONS.md W5): a classic site landing page rather
 * than the phone app's feed. Hero with search and one main call to action,
 * live numbers, newest homes, how it works, what the site offers, cities, a
 * closing call to action and the footer. Every number is read from the
 * database; nothing is invented. The phone apps keep app/(tabs)/index.tsx.
 */
export function WebsiteHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useAppDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { setFilter } = useFilters();
  const [query, setQuery] = useState('');

  const listings = usePropertiesQuery({}, FEATURED_COUNT);
  const total = usePropertiesCountQuery({});
  const cities = useCityTilesQuery();
  const agents = useAgentDirectoryQuery();

  const wide = width >= 900;
  const cardColumns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const stepColumns = width >= 900 ? 4 : 2;
  const serviceColumns = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  const search = () => {
    const city = query.trim();
    setFilter('zone', null, { immediate: true });
    setFilter('city', city || null, { immediate: true });
    router.push('/explore' as Href);
  };

  const stats = [
    { value: total.data, label: t('site.stats.listings') },
    { value: cities.data?.length, label: t('site.stats.cities') },
    { value: agents.data?.length, label: t('site.stats.agencies') },
  ];

  return (
    <GradientBackground>
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>{t('site.hero.eyebrow')}</Text>
          <Text style={[styles.h1, wide && styles.h1Wide]} accessibilityRole="header" aria-level={1}>
            {t('site.hero.title')} <Text style={styles.h1Em}>{t('site.hero.titleEm')}</Text>
          </Text>
          <Text style={styles.lead}>{t('site.hero.lead')}</Text>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={22} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('home.searchPlaceholder')}
              returnKeyType="search"
            />
            <Pressable accessibilityRole="button" onPress={search} style={styles.searchBtn}>
              <LinearGradient colors={[colors.accent, colors.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.searchBtnText}>{t('common.search')}</Text>
            </Pressable>
          </View>
          <View style={styles.heroLinks}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/listing/new' as Href)} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>{t('site.listHome')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/wanted' as Href)} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>{t('wanted.postCta')}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Live numbers */}
      <View style={styles.stats}>
        {/* A zero is left out: "0 agencies" says nothing useful. */}
        {stats.filter((s) => s.value !== 0).map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{typeof s.value === 'number' ? s.value.toLocaleString() : '—'}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Newest homes */}
      <Section
        styles={styles}
        eyebrow={t('site.listings.eyebrow')}
        title={t('site.listings.title')}
        action={{ label: t('home.seeAll'), onPress: () => router.push('/explore' as Href) }}>
        {listings.isError ? (
          <View style={styles.notice}>
            <Text style={styles.body}>{t('common.error')}</Text>
            <Pressable accessibilityRole="button" onPress={() => void listings.refetch()}>
              <Text style={styles.actionText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : !listings.isLoading && (listings.data?.length ?? 0) === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.body}>{t('search.empty')}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {(listings.isLoading ? Array.from({ length: cardColumns }, () => null) : listings.data ?? []).map((p, i) => (
              <View key={p?.id ?? `s${i}`} style={[styles.cell, { width: `${100 / cardColumns}%` }]}>
                {p ? <PropertyCard property={p} /> : <SkeletonCard />}
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* How it works */}
      <Section styles={styles} eyebrow={t('site.steps.eyebrow')} title={t('site.steps.title')}>
        <View style={styles.grid}>
          {STEPS.map((k, i) => (
            <View key={k} style={[styles.cell, { width: `${100 / stepColumns}%` }]}>
              <View style={styles.card}>
                <Text style={styles.stepNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={styles.cardTitle}>{t(`site.steps.${k}.title`)}</Text>
                <Text style={styles.body}>{t(`site.steps.${k}.body`)}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* What the site offers */}
      <Section styles={styles} eyebrow={t('site.services.eyebrow')} title={t('site.services.title')}>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <View key={s.key} style={[styles.cell, { width: `${100 / serviceColumns}%` }]}>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(s.href as Href)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.iconWrap}>
                  <MaterialIcons name={s.icon} size={22} color={colors.accentText} />
                </View>
                <Text style={styles.cardTitle}>{t(`site.services.${s.key}.title`)}</Text>
                <Text style={styles.body}>{t(`site.services.${s.key}.body`)}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Section>

      {/* Cities */}
      {(cities.isLoading || (cities.data?.length ?? 0) > 0) && (
        <Section styles={styles} eyebrow={t('site.cities.eyebrow')} title={t('home.exploreCities')}>
          <CityRail
            tiles={cities.data ?? []}
            loading={cities.isLoading}
            failed={cities.isError}
            onRetry={() => void cities.refetch()}
            onSelect={(city) => {
              setFilter('zone', null, { immediate: true });
              setFilter('city', city, { immediate: true });
              router.push('/explore' as Href);
            }}
          />
        </Section>
      )}

      {/* Closing call to action */}
      <View style={styles.band}>
        <LinearGradient colors={[colors.accent, colors.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.bandTitle}>{t('site.cta.title')}</Text>
        <Text style={styles.bandBody}>{t('site.cta.body')}</Text>
        <View style={styles.heroLinks}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/explore' as Href)} style={styles.bandBtn}>
            <Text style={styles.bandBtnText}>{t('site.cta.search')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/listing/new' as Href)} style={styles.bandGhost}>
            <Text style={styles.bandGhostText}>{t('site.listHome')}</Text>
          </Pressable>
        </View>
      </View>

      <SiteFooter />
    </ScrollView>
    </GradientBackground>
  );
}

function Section({
  styles,
  eyebrow,
  title,
  action,
  children,
}: {
  styles: Styles;
  eyebrow: string;
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadText}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.h2} accessibilityRole="header" aria-level={2}>{title}</Text>
        </View>
        {action && (
          <Pressable accessibilityRole="link" onPress={action.onPress} style={styles.actionHit}>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    page: { flex: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 24 },
    hero: { paddingTop: 40, paddingBottom: 32 },
    heroWide: { paddingTop: 72, paddingBottom: 56 },
    heroText: { maxWidth: 760, gap: 16 },
    eyebrow: { fontFamily: Fonts.monoMedium, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accentText },
    h1: { fontFamily: Fonts.serif, fontSize: 40, lineHeight: 46, color: colors.textPrimary },
    h1Wide: { fontFamily: Fonts.serif, fontSize: 64, lineHeight: 70 },
    h1Em: { fontFamily: Fonts.serifItalic, color: colors.accentText },
    lead: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 28, color: colors.textSecondary, maxWidth: 620 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
      paddingLeft: 18,
      padding: 6,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: 640,
    },
    searchInput: { flex: 1, minHeight: 48, fontFamily: Fonts.sans, fontSize: 16, color: colors.textPrimary },
    searchBtn: { minHeight: 48, paddingHorizontal: 24, borderRadius: 26, overflow: 'hidden', justifyContent: 'center' },
    searchBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#fff' },
    heroLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    ghostBtn: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border },
    ghostText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingVertical: 24,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    stat: { flex: 1, minWidth: 160, paddingVertical: 8, gap: 4 },
    statValue: { fontFamily: Fonts.serif, fontSize: 44, color: colors.textPrimary },
    statLabel: { fontFamily: Fonts.sans, fontSize: 14, color: colors.textSecondary },
    section: { marginTop: 56, gap: 20 },
    sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
    sectionHeadText: { flex: 1, gap: 6 },
    h2: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 40, color: colors.textPrimary },
    actionHit: { minHeight: 44, justifyContent: 'center' },
    actionText: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.accentText },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
    cell: { padding: 8 },
    card: { flex: 1, gap: 8, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    pressed: { opacity: 0.85 },
    stepNum: { fontFamily: Fonts.mono, fontSize: 14, color: colors.accentText },
    iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
    cardTitle: { fontFamily: Fonts.sansBold, fontSize: 17, color: colors.textPrimary },
    body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    notice: { alignItems: 'flex-start', gap: 8, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    band: { marginTop: 64, padding: 40, borderRadius: 28, overflow: 'hidden', gap: 12, alignItems: 'flex-start' },
    bandTitle: { fontFamily: Fonts.serif, fontSize: 36, lineHeight: 42, color: '#fff' },
    bandBody: { fontFamily: Fonts.sans, fontSize: 17, lineHeight: 26, color: '#fff', maxWidth: 560 },
    bandBtn: { minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 24, backgroundColor: '#fff' },
    bandBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1a1612' },
    bandGhost: { minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#fff' },
    bandGhostText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#fff' },
  });
