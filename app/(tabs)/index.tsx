import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarClearance } from '@/components/liquid-tab-bar';
import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { PropertyCard, getCompactCardSnapInterval } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { RiseIn } from '@/components/ui/motion';
import { AppHeader } from '@/components/ui/app-header';
import { SearchHeader } from '@/components/ui/search-header';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { usePropertiesByIdsQuery, usePropertiesQuery } from '@/hooks/use-property-queries';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';

// Mirrors web's Home.jsx exactly: one query, sorted newest-first (the
// default sort), featured = properties[0], matched = properties.slice(1, 7)
// — NOT a separate "highest price" query, which is what this screen used to
// do before this pass (a real behavioral mismatch vs. the browser).
const HOME_LIMIT = 24;

// Device-local hour, not UTC — 6-12 morning, 12-19 afternoon, else evening.
// The previous version only split morning/evening (hour < 12), which
// silently mislabeled both the afternoon and the 00:00-05:59 window.
function getGreeting(hour: number, t: (key: string) => string): string {
  if (hour >= 6 && hour < 12) return t('home.greetingMorning');
  if (hour >= 12 && hour < 19) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { recentIds, reload: reloadRecent } = useRecentlyViewed();

  // react-query cache means Home <-> Property Detail <-> back within the
  // 60s staleTime shows the same list instantly with zero network calls,
  // instead of the full-screen spinner this used to force on every focus.
  const { data: listings = [], isLoading: loading, isError, refetch } = usePropertiesQuery({}, HOME_LIMIT);
  const { data: recentProperties = [] } = usePropertiesByIdsQuery(recentIds.slice(0, 6));
  const { width: screenWidth } = useResponsive();
  const snapInterval = getCompactCardSnapInterval(screenWidth);
  // The nav pill floats above content rather than pushing it up, so the
  // scroll has to reserve its full footprint or the last row sits under it.
  const tabBarClearance = useTabBarClearance();

  const greeting = getGreeting(new Date().getHours(), t);
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const matchCount = listings.length;

  // Recently Viewed reads AsyncStorage, not the network — refreshing it on
  // focus is free and needs no cache-staleness tradeoff, unlike `listings`.
  useFocusEffect(
    useCallback(() => {
      reloadRecent();
    }, [reloadRecent]),
  );

  const featured = listings[0] ?? null;
  const matched = listings.slice(1, 7);
  // Everything past the featured card and the carousel. HOME_LIMIT fetches 24;
  // before this only 7 were ever rendered, so 17 rows were fetched, parsed and
  // dropped on every visit. Same "Near you" grid the web Home now renders — no
  // extra query, and it keeps the two apps structurally identical.
  const rest = listings.slice(7);

  const headline = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Web's `.app-header` sits above the greeting hero on Home too. */}
        <AppHeader />
        <SearchHeader
          kicker={greeting}
          headline={headline}
          emphasis={t('home.matchesToday', { count: matchCount })}
          onSearchPress={() => router.push('/(tabs)/explore' as Href)}
        />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : isError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{t('common.error')}</Text>
              <TouchableOpacity onPress={() => refetch()} activeOpacity={0.7}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : listings.length === 0 ? (
            /* Home had no empty state: with zero listings it rendered the
               greeting and then nothing at all. Distinct from the error branch
               above, which means the fetch failed rather than genuinely
               returning no homes. Mirrors the web Home. */
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{t('search.empty')}</Text>
            </View>
          ) : (
            <>
              {featured && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('home.featured')}</Text>
                    <Text style={styles.editorsPick}>{t('home.editorsPick')}</Text>
                  </View>
                  <RiseIn>
                    <FeaturedPropertyCard property={featured} />
                  </RiseIn>
                </>
              )}

              {matched.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('home.matched')}</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(tabs)/explore' as Href)}
                      activeOpacity={0.7}>
                      <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.hScroll}
                    decelerationRate="fast"
                    snapToInterval={snapInterval}>
                    {matched.map((item, i) => (
                      <RiseIn key={item.id} index={i}>
                        <PropertyCard property={item} variant="compact" />
                      </RiseIn>
                    ))}
                  </ScrollView>
                </View>
              )}

              {recentProperties.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('common.recentlyViewed')}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.hScroll}
                    decelerationRate="fast"
                    snapToInterval={snapInterval}>
                    {recentProperties.map((item, i) => (
                      <RiseIn key={item.id} index={i}>
                        <PropertyCard property={item} variant="compact" />
                      </RiseIn>
                    ))}
                  </ScrollView>
                </View>
              )}

              {rest.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('common.nearYou')}</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(tabs)/explore' as Href)}
                      activeOpacity={0.7}>
                      <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.nearYouGrid}>
                    {rest.map((item, i) => (
                      <RiseIn key={item.id} index={i}>
                        <PropertyCard property={item} />
                      </RiseIn>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    // The featured block is a bare fragment, not wrapped in `section`
    // (marginTop: 28) like every other section, so the first heading sat
    // directly under the search bar with only SearchHeader's own 4px below it.
    // 24 here + that 4 = the same 28 gap the page uses between every other
    // section, rather than an arbitrary number.
    paddingTop: 24,
    paddingBottom: 24,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  // Same two-up wrap the skeletons use, so the loading placeholders and the
  // real "Near you" cards occupy the identical footprint (no layout jump).
  nearYouGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  errorCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  // Matches web's .section-title h2 — serif/500, not bold sans.
  sectionTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  // Matches web's .mono-eyebrow — monospace, not bold sans.
  editorsPick: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Matches web's .section-title a — muted by default, orange only on
  // :hover, which has no touch equivalent, so muted is the practical
  // always-on state here rather than always-orange.
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
});
