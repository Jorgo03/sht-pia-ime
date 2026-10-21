import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { useLeafletMaps } from '@/components/map/leaflet/use-leaflet-maps';
import { useTheme } from '@/contexts/theme-context';

import type { LocationPreviewMapProps } from './location-preview-map.types';

/** Web sibling of location-preview-map.native.tsx: the same still map of the
 *  spot, drawn with Leaflet once it has loaded in the browser. */
export function LocationPreviewMap({ latitude, longitude }: LocationPreviewMapProps) {
  const { colors } = useTheme();
  const maps = useLeafletMaps();

  if (!maps) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.surfaceAlt }]}>
        <MaterialIcons name="location-on" size={28} color={colors.textSecondary} />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <maps.PreviewMap latitude={latitude} longitude={longitude} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
