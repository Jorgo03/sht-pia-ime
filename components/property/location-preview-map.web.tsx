import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

import type { LocationPreviewMapProps } from './location-preview-map.types';

/** Web sibling of location-preview-map.native.tsx — react-native-maps has no
 *  web target, so this renders a static placeholder instead. The "Open in
 *  Maps" link rendered alongside this already covers the real navigation
 *  use case on every platform. */
export function LocationPreviewMap(_props: LocationPreviewMapProps) {
  const { colors } = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <MaterialIcons name="location-on" size={28} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
