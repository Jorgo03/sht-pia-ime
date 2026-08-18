import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useTabBarClearance } from '@/components/liquid-tab-bar';
import { AppHeader } from '@/components/ui/app-header';
import { MapScreenContent } from '@/components/map/map-screen-content';
import { FilterSheet } from '@/components/property/filter-sheet';
import { PropertyCard } from '@/components/property/property-card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { GradientBackground } from '@/components/ui/gradient-background';
import { RiseIn } from '@/components/ui/motion';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { Property } from '@/data/types';
import { useInfinitePropertiesQuery, usePropertiesCountQuery } from '@/hooks/use-property-queries';
import { useResponsive } from '@/hooks/use-responsive';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { filters, queryFilters, setFilter, reset, activeCount } = useFilters();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The nav pill floats above content rather than pushing it up, so the list
  // has to reserve its full footprint or the last row sits under it.
  const tabBarClearance = useTabBarClearance();
  const { columns } = useResponsive();

  // Local echo of filters.city so the field feels instant; the shared
  // filters-context already debounces the actual query (same 350ms web
  // debounces its own search box at), matching Search.jsx's search-field.
  const [searchText, setSearchText] = useState(filters.city ?? '');
  // Tracks what this field itself last pushed to filters.city, so the
  // sync-back effect below can tell "the sheet/reset changed it externally"
  // (update the field) apart from "my own debounce just landed" (no-op).
  const lastPushedCity = useRef<string | null>(filters.city ?? null);

  const [sheetOpen, setSheetOpen] = useState(false);
  // Matches web's Search.jsx viewMode toggle exactly — map is a view mode
  // of this same screen, not a separate tab/route.
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // react-query caches each (filters, page) combination — flipping the
  // Sale/Rent tab back and forth, or returning to a filter set visited
  // earlier this session, re-shows cached results instantly instead of
  // re-querying Supabase every time.
  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useInfinitePropertiesQuery(queryFilters);
  const properties = useMemo(() => data?.pages.flat() ?? [], [data]);
  const { data: total = 0 } = usePropertiesCountQuery(queryFilters);

  // Quick All/Sale/Rent tabs stay in sync with the sheet by reading the same
  // shared filter state rather than keeping their own copy.
  const listingTabs = useMemo(
    () => [t('common.all'), t('search.sale'), t('search.rent')],
    [t],
  );
  const activeTab = queryFilters.listingType
    ? queryFilters.listingType === 'sale'
      ? listingTabs[1]
      : listingTabs[2]
    : listingTabs[0];

  const handleTabChange = useCallback(
    (tab: string) => {
      const index = listingTabs.indexOf(tab);
      setFilter('listingType', index === 1 ? 'sale' : index === 2 ? 'rent' : null);
    },
    [listingTabs, setFilter],
  );

  // Feeds the same `city` facet the filter sheet's city chips write to —
  // matches Search.jsx, where the free-text box and the filter both resolve
  // to one `city` query param rather than two separate search mechanisms.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchText.trim() || null;
      lastPushedCity.current = next;
      setFilter('city', next);
    }, 350);
    return () => clearTimeout(id);
  }, [searchText, setFilter]);

  // City chip picked in the sheet, or Reset — not this field — changed
  // filters.city, so mirror it here too.
  useEffect(() => {
    const city = filters.city ?? null;
    if (city !== lastPushedCity.current) {
      lastPushedCity.current = city;
      setSearchText(city ?? '');
    }
  }, [filters.city]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasNextPage) return;
    fetchNextPage();
  }, [loading, loadingMore, hasNextPage, fetchNextPage]);

  // PropertyCard's outer wrapper is `flex: 1` so it fills its grid column,
  // but RiseIn sits between it and the row and defaults to content sizing —
  // so the card's flex resolved against RiseIn's collapsed width instead of
  // half the row, and every card rendered about a quarter of its proper size.
  // The animation wrapper has to carry the grid sizing, same reason
  // `cardOuter` exists in the first place.
  //
  // maxWidth keeps a lone item in a trailing odd row at one column's width
  // rather than letting it stretch across the whole row — web's CSS grid
  // gives it a single `1fr` track and this is the flexbox equivalent.
  const gridItemStyle = useMemo<ViewStyle>(
    () => ({ flex: 1, maxWidth: `${100 / columns}%` as DimensionValue }),
    [columns],
  );

  // No onPress here — PropertyCard self-navigates by default, which keeps
  // this render function's identity (and therefore each row's props)
  // referentially stable across re-renders, letting React.memo on
  // PropertyCard actually skip re-rendering rows whose data hasn't changed.
  // RiseIn wraps each row for the staggered entrance web gets from
  // polish.css's `.property-grid > *` nth-child delays.
  const renderItem = useCallback(
    ({ item, index }: { item: Property; index: number }) => (
      <RiseIn index={index} style={gridItemStyle}>
        <PropertyCard property={item} />
      </RiseIn>
    ),
    [gridItemStyle],
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Replaces the plain `common.appName` text this screen used to show
            — web renders the full `.app-header` here like everywhere else. */}
        <AppHeader />
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {/* Web's `.screen-headline`: "Explore <em>everything</em>." —
                serif with the emphasis in orange italic. Mobile was rendering
                a bold sans `search.title` and leaving headline/headlineEm
                unused, so the two screens didn't read as the same app. */}
            <Text style={styles.title}>
              {t('search.headline')}{' '}
              <Text style={styles.titleEm}>{t('search.headlineEm')}</Text>.
            </Text>
            <View style={styles.titleActions}>
              {/* Matches web's Search.jsx .view-toggle — map is a view mode
                  of this same screen, not a separate tab. */}
              <View style={styles.viewToggle}>
                <Pressable
                  style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
                  onPress={() => setViewMode('list')}
                  accessibilityLabel={t('search.listView')}>
                  <MaterialIcons
                    name="grid-view"
                    size={15}
                    color={viewMode === 'list' ? colors.textPrimary : colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
                  onPress={() => setViewMode('map')}
                  accessibilityLabel={t('search.mapView')}>
                  <MaterialIcons
                    name="map"
                    size={15}
                    color={viewMode === 'map' ? colors.textPrimary : colors.textSecondary}
                  />
                </Pressable>
              </View>
              <Pressable
                style={styles.filterButton}
                onPress={() => setSheetOpen(true)}
                accessibilityLabel={t('search.filtersTitle')}>
                <MaterialIcons
                  name="tune"
                  size={22}
                  color={colors.textPrimary}
                />
                {activeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.searchField}>
          <MaterialIcons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <FilterTabs
          tabs={listingTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {viewMode === 'map' ? (
          <View style={styles.mapWrap}>
            <MapScreenContent />
          </View>
        ) : loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            // FlatList can't change numColumns on a live instance — keying by
            // the column count forces a clean remount on rotation/tablet
            // resize instead of silently misrendering rows.
            key={`cols-${columns}`}
            data={properties}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={columns}
            contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.row}
            // Tuned for smooth scrolling per brief section 4.1.
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              // Web's `.result-count`: bold total + "homes in view" on the
              // left, a mono-caps eyebrow naming the current sort on the
              // right. Mobile only had the bare count.
              <View style={styles.countRow}>
                <Text style={styles.count}>
                  <Text style={styles.countStrong}>{total}</Text>{' '}
                  {t('search.homesInView')}
                </Text>
                {/* Web switches this to "Map view" when the map is showing,
                    but this header only renders inside the list branch, so
                    the sort label is the only reachable case here. */}
                <Text style={styles.countEyebrow}>
                  {t('search.sortedByRelevance').toUpperCase()}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialIcons name="search-off" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>{t('search.empty')}</Text>
                <Text style={styles.emptyHint}>{t('search.emptyHint')}</Text>
                {activeCount > 0 && (
                  <Pressable
                    style={styles.emptyResetButton}
                    onPress={() => {
                      reset();
                      setSearchText('');
                    }}>
                    <MaterialIcons name="restart-alt" size={14} color={colors.accent} />
                    <Text style={styles.emptyResetText}>{t('search.reset')}</Text>
                  </Pressable>
                )}
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  style={styles.footer}
                  color={colors.accent}
                />
              ) : null
            }
          />
        )}

        <FilterSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // .screen-headline: serif 500, 30px, line-height 1.05, -0.025em.
  title: {
    flexShrink: 1,
    fontFamily: Fonts?.serif,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.75,
    color: colors.textPrimary,
  },
  // `.screen-headline em` — italic accent. Static per-weight font files, so
  // the italic comes from the italic family, not a fontStyle override.
  titleEm: {
    fontFamily: Fonts?.serifItalic,
    color: colors.accent,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  viewToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: colors.accent,
  },
  mapWrap: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  row: {
    gap: 0,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  count: {
    flexShrink: 1,
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  countStrong: {
    fontFamily: Fonts?.sansBold,
    color: colors.textPrimary,
  },
  // Web's .mono-eyebrow: mono, 11px, 0.1em, uppercase, muted.
  countEyebrow: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textSecondary,
  },
  loader: {
    paddingTop: 100,
    alignItems: 'center',
  },
  footer: {
    paddingVertical: 20,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
