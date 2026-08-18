import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { LocationPreviewMapProps } from './location-preview-map.types';

/** react-native-maps only ever gets imported from this file (and
 *  map-canvas.native.tsx) — never from a plain, platform-unsuffixed module,
 *  so Metro never pulls its native-only internals into the web bundle. */
export function LocationPreviewMap({ latitude, longitude }: LocationPreviewMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      userInterfaceStyle="dark">
      <Marker coordinate={{ latitude, longitude }} />
    </MapView>
  );
}
