import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FeatureCollection } from 'geojson';

import { MapCanvas } from '@/components/map/map-canvas';
import type { CountyGroup, MapCanvasHandle, MapRegionLike } from '@/components/map/map-canvas.types';
import { type AtticoPalette } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { MAP_MARKER_LIMIT } from '@/data/properties';
import { Property } from '@/data/types';
import { useMapPropertiesQuery } from '@/hooks/use-property-queries';
import { Cluster, clusterProperties, MARKER_COLORS } from '@/lib/cluster';
import { boundsToRegion, geometryBounds, pointInGeometry, type GeoJSONGeometry } from '@/lib/geo';
import { formatPrice, getLocalizedText, priceSuffixKey } from '@/lib/format';
import albaniaCountiesRaw from '@/data/albania-counties.json';

const LEGEND_TYPES: (keyof typeof MARKER_COLORS)[] = ['sale', 'rent', 'commercial', 'land'];

const albaniaCounties = albaniaCountiesRaw as FeatureCollection;

/** Opening view: the whole country, so a new user sees every market at once. */
const ALBANIA: MapRegionLike = {
  latitude: 41.15,
  longitude: 19.95,
  latitudeDelta: 2.4,
  longitudeDelta: 2.0,
};

/** Brief section 4.1: don't refetch on every frame of a pan. */
const REGION_DEBOUNCE_MS = 350;

// Below this the map shows county circles; at/above it, individual property
// clusters. The largest county's own padded bounds top out around 1.3, the
// whole-country opening view is 2.4 — this sits in the gap between them so
// neither a full-country view nor a single-county view flickers at the edge.
const REGION_OVERVIEW_THRESHOLD = 1.6;

function groupByCounty(properties: Property[]): CountyGroup[] {
  const groups: CountyGroup[] = albaniaCounties.features.map((f) => ({
    id: String(f.properties?.GID_1),
    name: String(f.properties?.NAME_1),
    geometry: f.geometry as unknown as GeoJSONGeometry,
    count: 0,
  }));

  for (const p of properties) {
    if (p.latitude == null || p.longitude == null) continue;
    const match = groups.find((g) => pointInGeometry(p.longitude as number, p.latitude as number, g.geometry));
    if (match) match.count++;
  }

  return groups.filter((g) => g.count > 0);
}

/**
 * The map view, extracted from what used to be a standalone tab so it can be
 * embedded as Explore's "map" view mode instead — matches web's Search.jsx,
 * where map is a viewMode toggle on the same page, not a separate route.
 * Same clustering/county-grouping/preview-card behavior as before, just
 * without its own top-edge SafeAreaView since it now renders below Explore's
 * header rather than at the physical top of the screen.
 */
export function MapScreenContent() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { queryFilters, activeCount } = useFilters();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapRef = useRef<MapCanvasHandle | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState<MapRegionLike>(ALBANIA);
  const [queryRegion, setQueryRegion] = useState<MapRegionLike>(ALBANIA);
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);

  // onRegionChangeComplete already fires only at gesture end; the extra debounce
  // covers momentum scrolling, which can settle several times in quick succession.
  const handleRegionChange = useCallback((next: MapRegionLike) => {
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
  // so the map always reflects the same facets as the list tab. Cached by
  // react-query per (filters, bounds) pair, so panning back to a viewport
  // already seen this session re-shows it instantly instead of re-fetching.
  const mapFilters = useMemo(
    () => ({
      ...queryFilters,
      bounds: {
        minLat: queryRegion.latitude - queryRegion.latitudeDelta / 2,
        maxLat: queryRegion.latitude + queryRegion.latitudeDelta / 2,
        minLng: queryRegion.longitude - queryRegion.longitudeDelta / 2,
        maxLng: queryRegion.longitude + queryRegion.longitudeDelta / 2,
      },
    }),
    [queryFilters, queryRegion],
  );
  const { data: properties = [], isLoading: loading } = useMapPropertiesQuery(mapFilters);

  const clusters = useMemo(
    () => clusterProperties(properties, region),
    [properties, region],
  );

  // Zoomed out enough to see multiple counties at once: show the
  // county-grouped overview instead of individual property clusters. The
  // viewport-bounds fetch above already covers ~the whole country at this
  // zoom (capped at MAP_MARKER_LIMIT), so no separate fetch is needed —
  // same properties data, just grouped differently.
  const isRegionOverview = region.latitudeDelta > REGION_OVERVIEW_THRESHOLD;
  const countyGroups = useMemo(
    () => (isRegionOverview ? groupByCounty(properties) : []),
    [isRegionOverview, properties],
  );

  const handleCountyPress = useCallback((countyId: string) => {
    setPreviewProperty(null);
    const feature = albaniaCounties.features.find((f) => String(f.properties?.GID_1) === countyId);
    if (!feature) return;
    const bounds = geometryBounds(feature.geometry as unknown as GeoJSONGeometry);
    mapRef.current?.animateToRegion(boundsToRegion(bounds), 500);
  }, []);

  const handleMarkerPress = useCallback(
    (cluster: Cluster) => {
      if (cluster.properties.length === 1) {
        // Mirrors web's PropertyPopup — a quick preview card, not an
        // immediate navigation, so tapping a pin doesn't leave the map.
        setPreviewProperty(cluster.properties[0]);
        return;
      }
      setPreviewProperty(null);
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
    [region],
  );

  return (
    <View style={styles.container}>
      <MapCanvas
        ref={mapRef}
        initialRegion={ALBANIA}
        onRegionChangeComplete={handleRegionChange}
        onMapPress={() => setPreviewProperty(null)}
        isRegionOverview={isRegionOverview}
        countyGeojson={albaniaCounties}
        countyGroups={countyGroups}
        onCountyPress={handleCountyPress}
        clusters={clusters}
        onMarkerPress={handleMarkerPress}
        accentColor={colors.accent}
        properties={properties}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.count}>
              {/* Base key, not the `_other` variant — naming a plural suffix
                  directly bypasses i18next's plural resolution, so a single
                  result rendered as "1 properties" and Slavic locales never
                  reached their `few`/`many` forms. */}
              {t('search.results', { count: properties.length })}
              {properties.length === MAP_MARKER_LIMIT ? '+' : ''}
            </Text>
          )}
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </View>

        {!isRegionOverview && (
          <View style={styles.legend}>
            {LEGEND_TYPES.map((type) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS[type] }]} />
                <Text style={styles.legendLabel}>{t(`listing.type.${type}`, type)}</Text>
              </View>
            ))}
          </View>
        )}

        {!loading && properties.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('search.empty')}</Text>
            <Text style={styles.emptyHint}>{t('search.emptyHint')}</Text>
          </View>
        )}
      </View>

      {previewProperty && (
        <View style={styles.previewCard} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.previewTouchable}
            activeOpacity={0.9}
            onPress={() => router.push(`/property/${previewProperty.id}` as Href)}>
            {previewProperty.image_urls?.[0] ? (
              <Image
                source={{ uri: previewProperty.image_urls[0] }}
                style={styles.previewImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.previewImage, styles.previewImagePlaceholder]} />
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {getLocalizedText(previewProperty.title_i18n, i18n.language) || previewProperty.title}
              </Text>
              <Text style={styles.previewPrice}>
                {formatPrice(previewProperty.price, i18n.language)}
                {(() => {
                  const key = priceSuffixKey(previewProperty.listing_type);
                  return key ? t(key) : '';
                })()}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {t(`search.${previewProperty.property_type}`, previewProperty.property_type ?? '')}
                {' · '}
                {t(`listing.type.${previewProperty.listing_type}`, previewProperty.listing_type ?? '')}
              </Text>
            </View>
            <View style={styles.previewCta}>
              <Text style={styles.previewCtaText}>{t('common.viewAll')}</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewProperty(null)}
            hitSlop={10}>
            <MaterialIcons name="close" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  count: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  previewTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  previewImagePlaceholder: {
    backgroundColor: colors.surfaceAlt,
  },
  previewInfo: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  previewMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  previewClose: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
