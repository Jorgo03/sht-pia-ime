import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { AgentAvatar } from '@/components/home/agent-rail';
import { CityRail } from '@/components/home/city-rail';
import { PropertyCard } from '@/components/property/property-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { SiteFooter } from '@/components/web/site-footer';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { useAppDimensions } from '@/hooks/use-app-dimensions';
import { useHydrated } from '@/hooks/use-hydrated';
import { useAgentDirectoryQuery, useCityTilesQuery, usePropertiesCountQuery, usePropertiesQuery } from '@/hooks/use-property-queries';
import { setOverHero } from '@/lib/web/hero-state';

type IconName = keyof typeof MaterialIcons.glyphMap;

const LATEST_COUNT = 8;
const CONTENT_MAX = 1280;
/** The dark sections' ground, the same in both themes, as on the reference. */
const INK = '#0b0a09';
const ON_INK = '#fbfbfb';
const ON_INK_SOFT = 'rgba(251,251,251,0.62)';
const LINE_ON_INK = 'rgba(251,251,251,0.12)';

const STEPS: { key: string; icon: IconName }[] = [
  { key: 'search', icon: 'search' },
  { key: 'compare', icon: 'compare-arrows' },
  { key: 'visit', icon: 'event-available' },
  { key: 'buy', icon: 'verified-user' },
];

const SERVICES: { key: string; icon: IconName; href: string }[] = [
  { key: 'wanted', icon: 'person-search', href: '/wanted' },
  { key: 'priceHistory', icon: 'trending-down', href: '/explore' },
  { key: 'currency', icon: 'currency-exchange', href: '/explore' },
  { key: 'viewings', icon: 'event-available', href: '/explore' },
  { key: 'chat', icon: 'forum', href: '/explore' },
  { key: 'guide', icon: 'flight-land', href: '/guide' },
];

/**
 * The website's Home (DECISIONS.md W5, W9), laid out after the owner's
 * reference site: a full-screen hero under a floating header, light sections
 * framed by thin grid lines with orange corner marks, numbered cards, a dark
 * "how it works" band, live numbers, a dark services section with an orange
 * glow, the newest homes, a closing band and a black footer. Shtëpia.ime's
 * own words, palette and data throughout; every number is read from the
 * database. The phone apps keep app/(tabs)/index.tsx.
 */
export function WebsiteHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useAppDimensions();
  const { height: windowHeight } = useWindowDimensions();
  const hydrated = useHydrated();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { setFilter } = useFilters();
  const [query, setQuery] = useState('');

  const listings = usePropertiesQuery({}, LATEST_COUNT);
  const total = usePropertiesCountQuery({});
  const cities = useCityTilesQuery();
  const agents = useAgentDirectoryQuery();

  const wide = width >= 900;
  const phone = width < 600;
  // The pre-rendered page has no window height: a fixed one until it starts.
  const heroHeight = hydrated ? Math.max(windowHeight, phone ? 600 : 680) : 720;

  // Leaving Home puts the header back to its solid bar.
  useEffect(() => () => setOverHero(true), []);

  const go = (href: string) => router.push(href as Href);
  const search = () => {
    const city = query.trim();
    setFilter('zone', null, { immediate: true });
    setFilter('city', city || null, { immediate: true });
    go('/explore');
  };

  const stats = [
    { value: total.data, label: t('site.stats.listings') },
    { value: cities.data?.length, label: t('site.stats.cities') },
    { value: agents.data?.length, label: t('site.stats.agencies') },
  ].filter((s) => s.value !== 0);

  return (
    <ScrollView
      style={styles.page}
      scrollEventThrottle={32}
      onScroll={(e) => setOverHero(e.nativeEvent.contentOffset.y < heroHeight - 90)}>
      {/* ── Hero ── */}
      <View style={[styles.hero, { minHeight: heroHeight }]}>
        <Glow size={phone ? 420 : 760} style={{ right: phone ? -180 : -120, top: phone ? 40 : -80 }} />
        <Glow size={phone ? 260 : 420} opacity={0.28} style={{ left: -140, bottom: -160 }} />
        <LinearGradient
          colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.55)']}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Contain style={styles.heroInner}>
          <Text style={styles.heroEyebrow}>{t('site.hero.eyebrow')}</Text>
          <Text
            style={[styles.heroTitle, wide ? styles.heroTitleWide : phone ? styles.heroTitlePhone : null]}
            accessibilityRole="header"
            aria-level={1}>
            {t('site.hero.title')} {t('site.hero.titleEm')}
          </Text>
          <Text style={styles.heroLead}>{t('site.hero.lead')}</Text>
          <View style={[styles.searchBox, phone && styles.searchBoxPhone]}>
            <MaterialIcons name="search" size={22} color="#6b625a" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor="#8a8178"
              accessibilityLabel={t('home.searchPlaceholder')}
              returnKeyType="search"
            />
            <Pressable accessibilityRole="button" onPress={search} style={styles.searchBtn}>
              <Text style={styles.searchBtnText}>{t('common.search')}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <PillButton label={t('site.cta.search')} onPress={() => go('/explore')} arrow />
            <PillButton label={t('site.listHome')} onPress={() => go('/listing/new')} ghost onInk />
          </View>
        </Contain>
      </View>

      {/* ── Two promises: framed, numbered ── */}
      <View style={styles.light}>
        <Contain style={styles.frame}>
          <Corners />
          <Text style={[styles.h2Center, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
            {t('site.services.title')}
          </Text>
        </Contain>
        <Contain style={[styles.frame, styles.frameTopLine, wide && styles.rowCells]}>
          {(['wanted', 'guide'] as const).map((k, i) => (
            <Pressable
              key={k}
              accessibilityRole="link"
              onPress={() => go(k === 'wanted' ? '/wanted' : '/guide')}
              style={({ pressed }) => [styles.bigCell, wide && i === 0 && styles.cellDivider, !wide && i === 0 && styles.cellDividerBottom, pressed && styles.pressed]}>
              <View style={styles.cellHead}>
                <MaterialIcons name={k === 'wanted' ? 'person-search' : 'flight-land'} size={40} color={colors.accent} />
                <Text style={styles.cellNum}>{String(i + 1).padStart(2, '0')}</Text>
              </View>
              <Text style={[styles.cellTitle, phone && styles.cellTitlePhone]}>{t(`site.services.${k}.title`)}</Text>
              <Text style={styles.cellBody}>{t(`site.services.${k}.body`)}</Text>
            </Pressable>
          ))}
        </Contain>

        {/* Agencies on the site, the reference's logo strip. */}
        {(agents.data?.length ?? 0) > 0 && (
          <Contain style={[styles.frame, styles.frameTopLine, styles.strip]}>
            <View style={[styles.stripCell, styles.stripLabelCell]}>
              <Text style={styles.stripLabel}>{t('home.agencies')}</Text>
            </View>
            {(agents.data ?? []).slice(0, wide ? 5 : 3).map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="link"
                accessibilityLabel={a.title}
                onPress={() => go(`/agent/${a.id}`)}
                style={({ pressed }) => [styles.stripCell, pressed && styles.pressed]}>
                <AgentAvatar name={a.title} uri={a.avatar} size={40} radius={12} />
                {wide && <Text style={styles.stripName} numberOfLines={1}>{a.title}</Text>}
              </Pressable>
            ))}
          </Contain>
        )}
      </View>

      {/* ── How it works: dark band ── */}
      <View style={styles.dark}>
        <Contain style={styles.darkHead}>
          <Eyebrow text={t('site.steps.eyebrow')} onInk />
          <Text style={[styles.h2OnInk, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
            {t('site.steps.title')}
          </Text>
        </Contain>
        <Contain>
          <View style={[styles.gridOnInk, wide && styles.wrapRow]}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.stepCell, wide && styles.half, wide && i % 2 === 0 && styles.cellDividerInk]}>
              <View style={styles.cellHead}>
                <Text style={styles.cellNumInk}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={styles.ring}>
                  <MaterialIcons name={s.icon} size={26} color={ON_INK} />
                </View>
              </View>
              <Text style={[styles.cellTitleInk, phone && styles.cellTitlePhone]}>{t(`site.steps.${s.key}.title`)}</Text>
              <Text style={styles.cellBodyInk}>{t(`site.steps.${s.key}.body`)}</Text>
            </View>
          ))}
          </View>
        </Contain>
      </View>

      {/* ── In numbers ── */}
      {stats.length > 0 && (
        <View style={styles.light}>
          <Contain style={[styles.statsHead, wide && styles.statsHeadWide]}>
            <View style={styles.flex}>
              <Eyebrow text={t('site.listings.eyebrow')} />
              <Text style={[styles.h2, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
                {t('site.stats.title')}
              </Text>
            </View>
            <View style={[styles.flex, styles.statsAside]}>
              <Text style={styles.cellBody}>{t('site.stats.body')}</Text>
              <View style={styles.row}>
                <PillButton label={t('site.cta.search')} onPress={() => go('/explore')} arrow />
              </View>
            </View>
          </Contain>
          <Contain style={[styles.frame, styles.frameTopLine, styles.frameBottomLine, wide && styles.rowCells]}>
            {stats.map((s, i) => (
              <View key={s.label} style={[styles.statCell, wide && i < stats.length - 1 && styles.cellDivider, !wide && i < stats.length - 1 && styles.cellDividerBottom]}>
                <Text style={[styles.statValue, phone && styles.statValuePhone]}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : '—'}
                </Text>
                <Text style={styles.cellBody}>{s.label}</Text>
              </View>
            ))}
          </Contain>
        </View>
      )}

      {/* ── What the site offers: dark, orange glow ── */}
      <View style={styles.dark}>
        <Glow size={phone ? 360 : 640} opacity={0.55} style={{ right: phone ? -200 : -160, top: -220 }} />
        <Contain style={styles.darkHead}>
          <Eyebrow text={t('site.services.eyebrow')} onInk />
          <Text style={[styles.h2OnInk, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
            {t('site.cta.body')}
          </Text>
        </Contain>
        <Contain>
          <View style={[styles.wrapRow, styles.servicesGrid]}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.key}
              accessibilityRole="link"
              onPress={() => go(s.href)}
              style={({ pressed }) => [styles.serviceCell, { width: wide ? '33.333%' : phone ? '100%' : '50%' }, pressed && styles.pressed]}>
              <MaterialIcons name={s.icon} size={34} color={colors.accent} />
              <Text style={styles.serviceTitle}>{t(`site.services.${s.key}.title`)}</Text>
              <Text style={styles.cellBodyInk}>{t(`site.services.${s.key}.body`)}</Text>
            </Pressable>
          ))}
          </View>
        </Contain>
      </View>

      {/* ── Newest homes ── */}
      <View style={styles.light}>
        <Contain style={[styles.statsHead, wide && styles.statsHeadWide]}>
          <View style={styles.flex}>
            <Eyebrow text={t('site.listings.eyebrow')} />
            <Text style={[styles.h2, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
              {t('site.listings.title')}
            </Text>
          </View>
          <View style={[styles.row, styles.endRow]}>
            <PillButton label={t('home.seeAll')} onPress={() => go('/explore')} />
          </View>
        </Contain>
        <Contain>
          {listings.isError ? (
            <View style={styles.notice}>
              <Text style={styles.cellBody}>{t('common.error')}</Text>
              <Pressable accessibilityRole="button" onPress={() => void listings.refetch()}>
                <Text style={styles.link}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : !listings.isLoading && (listings.data?.length ?? 0) === 0 ? (
            <View style={styles.notice}>
              <Text style={styles.cellBody}>{t('search.empty')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {(listings.isLoading ? Array.from({ length: 4 }, () => null) : listings.data ?? []).map((p, i) => (
                <View key={p?.id ?? `s${i}`} style={[styles.card, phone && styles.cardPhone]}>
                  {p ? <PropertyCard property={p} detailed /> : <SkeletonCard />}
                </View>
              ))}
            </ScrollView>
          )}
        </Contain>
        {(cities.isLoading || (cities.data?.length ?? 0) > 0) && (
          <Contain style={styles.citiesBlock}>
            <Eyebrow text={t('site.cities.eyebrow')} />
            <CityRail
              tiles={cities.data ?? []}
              loading={cities.isLoading}
              failed={cities.isError}
              onRetry={() => void cities.refetch()}
              onSelect={(city) => {
                setFilter('zone', null, { immediate: true });
                setFilter('city', city, { immediate: true });
                go('/explore');
              }}
            />
          </Contain>
        )}
      </View>

      {/* ── Closing band ── */}
      <View style={[styles.dark, styles.band]}>
        <Glow size={phone ? 380 : 620} opacity={0.5} style={{ left: '50%', top: -260, marginLeft: phone ? -190 : -310 }} />
        <Contain style={styles.bandInner}>
          <Text style={[styles.bandTitle, phone && styles.h2Phone]} accessibilityRole="header" aria-level={2}>
            {t('site.cta.title')}
          </Text>
          <Text style={styles.bandBody}>{t('site.footer.tagline')}</Text>
          <View style={[styles.row, styles.centerRow]}>
            <PillButton label={t('site.cta.search')} onPress={() => go('/explore')} arrow />
            <PillButton label={t('site.listHome')} onPress={() => go('/listing/new')} ghost onInk />
          </View>
        </Contain>
      </View>

      <SiteFooter />
    </ScrollView>
  );
}

/** Centres a section's content at the site width, with the page gutter. */
function Contain({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[containStyles.contain, style]}>{children}</View>;
}

const containStyles = StyleSheet.create({
  contain: { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', paddingHorizontal: 24 },
});

/** A soft orange light, the reference's glow, drawn with a blurred circle. */
function Glow({ size, opacity = 0.75, style }: { size: number; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accent,
          opacity,
          // A CSS blur: the website only draws this component.
          filter: `blur(${Math.round(size / 5)}px)`,
        },
        style,
      ]}
    />
  );
}

/** Small orange squares on a framed section's corners. */
function Corners() {
  const { colors } = useTheme();
  const mark: ViewStyle = { position: 'absolute', width: 6, height: 6, backgroundColor: colors.accent };
  return (
    <>
      <View pointerEvents="none" style={[mark, { left: -3, top: -3 }]} />
      <View pointerEvents="none" style={[mark, { right: -3, top: -3 }]} />
      <View pointerEvents="none" style={[mark, { left: -3, bottom: -3 }]} />
      <View pointerEvents="none" style={[mark, { right: -3, bottom: -3 }]} />
    </>
  );
}

function Eyebrow({ text, onInk = false }: { text: string; onInk?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={eyebrowStyles.row}>
      <View style={[eyebrowStyles.square, { backgroundColor: colors.accent }]} />
      <Text style={[eyebrowStyles.text, { color: onInk ? ON_INK_SOFT : colors.textSecondary }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

const eyebrowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  square: { width: 6, height: 6 },
  text: { fontFamily: Fonts.sansMedium, fontSize: 12, letterSpacing: 1.2 },
});

/** The reference's orange pill, with an optional round arrow beside it. */
function PillButton({ label, onPress, arrow = false, ghost = false, onInk = false }: { label: string; onPress: () => void; arrow?: boolean; ghost?: boolean; onInk?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={pillStyles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          pillStyles.pill,
          ghost ? [pillStyles.ghost, onInk && pillStyles.ghostOnInk] : { backgroundColor: colors.accentEnd },
          pressed && { opacity: 0.85 },
        ]}>
        <Text style={[pillStyles.text, ghost && { color: onInk ? ON_INK : colors.textPrimary }]}>{label.toUpperCase()}</Text>
      </Pressable>
      {arrow && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [pillStyles.round, { backgroundColor: colors.accentEnd }, pressed && { opacity: 0.85 }]}>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { minHeight: 46, paddingHorizontal: 22, borderRadius: 40, justifyContent: 'center' },
  ghost: { borderWidth: 1, borderColor: 'rgba(127,127,127,0.45)', backgroundColor: 'rgba(127,127,127,0.10)' },
  ghostOnInk: { borderColor: 'rgba(251,251,251,0.45)', backgroundColor: 'rgba(251,251,251,0.06)' },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 14, letterSpacing: 0.5, color: '#fff' },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.primary },
    flex: { flex: 1 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    endRow: { justifyContent: 'flex-end', alignSelf: 'flex-end' },
    centerRow: { justifyContent: 'center' },
    pressed: { opacity: 0.85 },

    hero: { backgroundColor: INK, overflow: 'hidden', justifyContent: 'flex-end' },
    heroInner: { paddingTop: 140, paddingBottom: 72, gap: 18 },
    heroEyebrow: { fontFamily: Fonts.sansMedium, fontSize: 13, letterSpacing: 1.4, color: ON_INK_SOFT, textTransform: 'uppercase' },
    heroTitle: { fontFamily: Fonts.sans, fontSize: 60, lineHeight: 62, letterSpacing: -1.8, color: ON_INK, maxWidth: 900 },
    heroTitleWide: { fontFamily: Fonts.sans, fontSize: 88, lineHeight: 88, letterSpacing: -2.8 },
    heroTitlePhone: { fontFamily: Fonts.sans, fontSize: 42, lineHeight: 44, letterSpacing: -1.2 },
    heroLead: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 27, color: ON_INK_SOFT, maxWidth: 620 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
      paddingLeft: 18,
      padding: 6,
      borderRadius: 40,
      backgroundColor: '#fbfbfb',
      maxWidth: 640,
    },
    searchBoxPhone: { paddingLeft: 14 },
    searchInput: { flex: 1, minWidth: 0, width: 0, minHeight: 46, fontFamily: Fonts.sans, fontSize: 16, color: '#1a1612' },
    searchBtn: { minHeight: 46, paddingHorizontal: 22, borderRadius: 40, justifyContent: 'center', backgroundColor: colors.accentEnd },
    searchBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },

    light: { backgroundColor: colors.primary, paddingVertical: 72 },
    frame: { position: 'relative', borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, paddingVertical: 64 },
    frameTopLine: { borderTopWidth: 1, paddingVertical: 0 },
    frameBottomLine: { borderBottomWidth: 1 },
    rowCells: { flexDirection: 'row' },
    h2Center: { fontFamily: Fonts.sans, fontSize: 64, lineHeight: 66, letterSpacing: -1.9, color: colors.textPrimary, textAlign: 'center', maxWidth: 760, alignSelf: 'center' },
    h2: { fontFamily: Fonts.sans, fontSize: 56, lineHeight: 58, letterSpacing: -1.7, color: colors.textPrimary },
    h2Phone: { fontFamily: Fonts.sans, fontSize: 36, lineHeight: 39, letterSpacing: -1 },
    bigCell: { flex: 1, padding: 32, gap: 16, minHeight: 300 },
    cellDivider: { borderRightWidth: 1, borderColor: colors.border },
    cellDividerBottom: { borderBottomWidth: 1, borderColor: colors.border },
    cellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    cellNum: { fontFamily: Fonts.mono, fontSize: 13, color: colors.textSecondary },
    cellTitle: { fontFamily: Fonts.sans, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, color: colors.textPrimary },
    cellTitlePhone: { fontFamily: Fonts.sans, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
    cellBody: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, color: colors.textSecondary, maxWidth: 520 },
    link: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.accentText },

    strip: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 0, borderBottomWidth: 1 },
    stripCell: { flexGrow: 1, flexBasis: 140, minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, borderRightWidth: 1, borderColor: colors.border },
    stripLabelCell: { justifyContent: 'flex-start' },
    stripLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    stripName: { flexShrink: 1, fontFamily: Fonts.sansMedium, fontSize: 14, color: colors.textSecondary },

    dark: { backgroundColor: INK, paddingVertical: 96, overflow: 'hidden' },
    darkHead: { marginBottom: 48 },
    h2OnInk: { fontFamily: Fonts.sans, fontSize: 56, lineHeight: 58, letterSpacing: -1.7, color: ON_INK, maxWidth: 820 },
    gridOnInk: { borderTopWidth: 1, borderColor: LINE_ON_INK },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
    half: { width: '50%' },
    stepCell: { padding: 32, gap: 12, minHeight: 280, borderBottomWidth: 1, borderColor: LINE_ON_INK },
    cellDividerInk: { borderRightWidth: 1, borderColor: LINE_ON_INK },
    cellNumInk: { fontFamily: Fonts.mono, fontSize: 13, color: ON_INK_SOFT },
    ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(251,251,251,0.35)', alignItems: 'center', justifyContent: 'center' },
    cellTitleInk: { fontFamily: Fonts.sans, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, color: ON_INK },
    cellBodyInk: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23, color: ON_INK_SOFT, maxWidth: 420 },

    statsHead: { gap: 24, marginBottom: 40 },
    statsHeadWide: { flexDirection: 'row', alignItems: 'flex-end' },
    statsAside: { gap: 18 },
    statCell: { flex: 1, padding: 32, gap: 10 },
    statValue: { fontFamily: Fonts.sans, fontSize: 80, lineHeight: 84, letterSpacing: -2.4, color: colors.textPrimary },
    statValuePhone: { fontFamily: Fonts.sans, fontSize: 56, lineHeight: 60 },

    servicesGrid: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: LINE_ON_INK },
    serviceCell: { padding: 32, gap: 14, minHeight: 240, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE_ON_INK },
    serviceTitle: { fontFamily: Fonts.sans, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: ON_INK },

    cards: { gap: 16, paddingBottom: 8 },
    card: { width: 320 },
    cardPhone: { width: 270 },
    notice: { alignItems: 'flex-start', gap: 8, padding: 24, borderWidth: 1, borderColor: colors.border },
    citiesBlock: { marginTop: 56 },

    band: { paddingVertical: 128 },
    bandInner: { alignItems: 'center', gap: 20 },
    bandTitle: { fontFamily: Fonts.sans, fontSize: 64, lineHeight: 66, letterSpacing: -1.9, color: ON_INK, textAlign: 'center', maxWidth: 860 },
    bandBody: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 27, color: ON_INK_SOFT, textAlign: 'center', maxWidth: 560 },
  });
