import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { FilterSheet } from '@/components/property/filter-sheet';
import { PropertyCard } from '@/components/property/property-card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { GradientBackground } from '@/components/ui/gradient-background';
import { useFilters } from '@/contexts/filters-context';
import { getProperties, getPropertiesCount, PAGE_SIZE } from '@/data/properties';
import { Property } from '@/data/types';
import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useResponsive } from '@/hooks/use-responsive';

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { queryFilters, setFilter, activeCount } = useFilters();
  const { columns } = useResponsive();

  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getProperties(queryFilters, { offset: 0 }),
      getPropertiesCount(queryFilters),
    ])
      .then(([rows, count]) => {
        if (!active) return;
        setProperties(rows);
        setTotal(count);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (!active) return;
        setProperties([]);
        setTotal(0);
        setHasMore(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queryFilters]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);

    getProperties(queryFilters, { offset: properties.length })
      .then((rows) => {
        setProperties((prev) => [...prev, ...rows]);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, hasMore, queryFilters, properties.length]);

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard
        property={item}
        onPress={() => router.push(`/property/${item.id}` as Href)}
      />
    ),
    [router],
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.brand, { fontFamily: fonts.serifSemiBold, color: colors.orange1 }]}>
            {t('common.appName')}
          </Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontFamily: fonts.serif, color: colors.text }]}>
              {t('search.title')}
            </Text>
            <Pressable
              style={[
                styles.filterButton,
                { borderRadius: radii.pill, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
              ]}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel={t('search.filtersTitle')}>
              <MaterialIcons name="tune" size={22} color={colors.text} />
              {activeCount > 0 && (
                <View style={[styles.badge, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}>
                  <Text style={[styles.badgeText, { fontFamily: fonts.sansBold }]}>{activeCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <FilterTabs
          tabs={listingTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.orange1} />
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
            contentContainerStyle={styles.list}
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
              <Text style={[styles.count, { fontFamily: fonts.sansSemiBold, color: colors.textMuted }]}>
                {t('search.results_other', { count: total })}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { fontFamily: fonts.serif, color: colors.text }]}>
                  {t('search.empty')}
                </Text>
                <Text style={[styles.emptyHint, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                  {t('search.emptyHint')}
                </Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={styles.footer} color={colors.orange1} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
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
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  row: {
    gap: 0,
  },
  count: {
    paddingHorizontal: 6,
    paddingBottom: 12,
    fontSize: 13,
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
    fontSize: 18,
  },
  emptyHint: {
    fontSize: 13,
  },
});
