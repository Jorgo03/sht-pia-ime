import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

import { useLeafletMaps } from './leaflet/use-leaflet-maps';
import type { MapCanvasHandle, MapCanvasProps } from './map-canvas.types';

/**
 * Web sibling of map-canvas.native.tsx. react-native-maps has no web target
 * (importing it breaks Metro's web bundle), so the website draws the same
 * map with Leaflet: county outlines and counts when zoomed out, price and
 * cluster bubbles when zoomed in, the same callbacks as the native map.
 * Leaflet loads in the browser after hydration; a spinner holds its place.
 */
function MapCanvasWeb(
  props: MapCanvasProps & { bottomInset?: number },
  ref: React.ForwardedRef<MapCanvasHandle>,
) {
  const { colors } = useTheme();
  const maps = useLeafletMaps();
  const inner = useRef<MapCanvasHandle | null>(null);

  // Stable for the parent; forwards to the Leaflet map once it exists.
  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs) => inner.current?.animateToRegion(region, durationMs),
  }));

  if (!maps) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <maps.ExploreMap {...props} handleRef={inner} colors={colors} />
    </View>
  );
}

export const MapCanvas = forwardRef(MapCanvasWeb);

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  center: { alignItems: 'center', justifyContent: 'center' },
});
