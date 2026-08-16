import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ClusterMarker } from '@/components/map/cluster-marker';
import { useFilters } from '@/contexts/filters-context';
import { getMapProperties, MAP_MARKER_LIMIT } from '@/data/properties';
import { Property } from '@/data/types';
import { useFhoTheme } from '@/hooks/use-fho-theme';
import { Cluster, clusterProperties } from '@/lib/cluster';

/** Opening view: the whole country, so a new user sees every market at once. */
const ALBANIA: Region = {
  latitude: 41.15,
  longitude: 19.95,
  latitudeDelta: 2.4,
  longitudeDelta: 2.0,
};

/** Brief section 4.1: don't refetch on every frame of a pan. */
const REGION_DEBOUNCE_MS = 350;

export default function MapScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, radii, fonts, isDark } = useFhoTheme();
  const { queryFilters, activeCount } = useFilters();

  const mapRef = useRef<MapView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState<Region>(ALBANIA);
  const [queryRegion, setQueryRegion] = useState<Region>(ALBANIA);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // onRegionChangeComplete already fires only at gesture end; the extra debounce
  // covers momentum scrolling, which can settle several times in quick succession.
  const handleRegionChange = useCallback((next: Region) => {
    setRegion(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setQueryRegion(next),
      REGION_DEBOUNCE_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Re-queries when the shared filters change OR the visible region settles,
  // so the map always reflects the same facets as the list tab.
  useEffect(() => {
    let active = true;
    setLoading(true);

    getMapProperties({
      ...queryFilters,
      bounds: {
        minLat: queryRegion.latitude - queryRegion.latitudeDelta / 2,
        maxLat: queryRegion.latitude + queryRegion.latitudeDelta / 2,
        minLng: queryRegion.longitude - queryRegion.longitudeDelta / 2,
        maxLng: queryRegion.longitude + queryRegion.longitudeDelta / 2,
      },
    })
      .then((rows) => {
        if (active) setProperties(rows);
      })
      .catch(() => {
        if (active) setProperties([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queryFilters, queryRegion]);

  const clusters = useMemo(
    () => clusterProperties(properties, region),
    [properties, region],
  );

  const handleMarkerPress = useCallback(
    (cluster: Cluster) => {
      if (cluster.properties.length === 1) {
        router.push(`/property/${cluster.properties[0].id}` as Href);
        return;
      }
      // Zoom toward the cluster rather than expanding it in place — the next
      // render re-clusters at the tighter zoom and splits it apart.
      mapRef.current?.animateToRegion(
        {
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          latitudeDelta: Math.max(region.latitudeDelta / 2.5, 0.002),
          longitudeDelta: Math.max(region.longitudeDelta / 2.5, 0.002),
        },
        350,
      );
    },
    [region, router],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={ALBANIA}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={false}
        toolbarEnabled={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}>
        {clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            { borderRadius: radii.pill, backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.orange1} />
          ) : (
            <Text style={[styles.count, { fontFamily: fonts.sansBold, color: colors.text }]}>
              {t('search.results_other', { count: properties.length })}
              {properties.length === MAP_MARKER_LIMIT ? '+' : ''}
            </Text>
          )}
          {activeCount > 0 && (
            <View style={[styles.badge, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}>
              <Text style={[styles.badgeText, { fontFamily: fonts.sansBold }]}>{activeCount}</Text>
            </View>
          )}
        </View>

        {!loading && properties.length === 0 && (
          <View
            style={[
              styles.empty,
              { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}>
            <Text style={[styles.emptyTitle, { fontFamily: fonts.serif, color: colors.text }]}>
              {t('search.empty')}
            </Text>
            <Text style={[styles.emptyHint, { fontFamily: fonts.sans, color: colors.textMuted }]}>
              {t('search.emptyHint')}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  count: {
    fontSize: 14,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
  },
  empty: {
    alignSelf: 'center',
    marginTop: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptyHint: {
    fontSize: 13,
  },
});
