import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Geojson, type Region } from 'react-native-maps';

import { ClusterMarker } from '@/components/map/cluster-marker';
import { CountyMarker } from '@/components/map/county-marker';
import { geometryCentroid } from '@/lib/geo';

import type { MapCanvasHandle, MapCanvasProps } from './map-canvas.types';

/**
 * The actual native map surface — react-native-maps only ever gets imported
 * from this file. Metro resolves `.native.tsx` for iOS/Android automatically
 * (Expo's platform-extension convention), so nothing on the web bundling
 * graph ever reaches this module.
 */
function MapCanvasNative(
  {
    initialRegion,
    onRegionChangeComplete,
    onMapPress,
    isRegionOverview,
    countyGeojson,
    countyGroups,
    onCountyPress,
    clusters,
    onMarkerPress,
    accentColor,
  }: MapCanvasProps,
  ref: React.ForwardedRef<MapCanvasHandle>,
) {
  const mapRef = useRef<MapView | null>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs) => {
      mapRef.current?.animateToRegion(region as Region, durationMs);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion as Region}
      onRegionChangeComplete={(region) => onRegionChangeComplete(region)}
      onPress={onMapPress}
      showsUserLocation={false}
      toolbarEnabled={false}
      userInterfaceStyle="dark">
      {isRegionOverview ? (
        <>
          <Geojson
            geojson={countyGeojson}
            strokeColor={accentColor}
            fillColor="rgba(255,107,0,0.06)"
            strokeWidth={1}
          />
          {countyGroups.map((county) => (
            <CountyMarker
              // The count is in the key: Android draws a marker once
              // (tracksViewChanges goes off after mount), so the same marker
              // kept showing its old number after a filter change or a pan.
              key={`${county.id}:${county.count}`}
              id={county.id}
              count={county.count}
              coordinate={geometryCentroid(county.geometry)}
              onPress={onCountyPress}
            />
          ))}
        </>
      ) : (
        clusters.map((cluster) => (
          // Count in the key for the same Android redraw reason as above.
          <ClusterMarker key={`${cluster.id}:${cluster.properties.length}`} cluster={cluster} onPress={onMarkerPress} />
        ))
      )}
    </MapView>
  );
}

export const MapCanvas = forwardRef(MapCanvasNative);
