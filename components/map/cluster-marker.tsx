import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { Cluster, formatBubblePrice } from '@/lib/cluster';

interface Props {
  cluster: Cluster;
  onPress: (cluster: Cluster) => void;
}

/**
 * A price bubble (single listing) or a count bubble (cluster), used instead of
 * the default pin so the map communicates price at a glance.
 */
function ClusterMarkerBase({ cluster, onPress }: Props) {
  const { colors, radii, fonts } = useFhoTheme();
  const count = cluster.properties.length;
  const isCluster = count > 1;

  /**
   * Android renders a custom marker by snapshotting its view. Disabling
   * tracking before that first layout yields blank bubbles, but leaving it on
   * re-snapshots every marker on every pan and tanks framerate. So: track
   * briefly, then stop.
   */
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{
        latitude: cluster.latitude,
        longitude: cluster.longitude,
      }}
      onPress={() => onPress(cluster)}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}>
      <View
        style={[
          styles.bubble,
          { borderRadius: radii.md, backgroundColor: colors.orange1, borderColor: '#fff' },
          // Fixed navy rather than the theme's --fho-navy (which lifts to a pale
          // blue in dark mode for on-page contrast) — this sits on map tiles,
          // not app chrome, so it stays legible regardless of app theme.
          isCluster && {
            borderRadius: radii.lg,
            backgroundColor: '#0a2f63',
            borderColor: colors.orange1,
            minWidth: 36,
            paddingHorizontal: 12,
          },
        ]}>
        <Text style={[styles.label, { fontFamily: fonts.sansBold, color: '#fff' }]} numberOfLines={1}>
          {isCluster
            ? String(count)
            : formatBubblePrice(cluster.properties[0].price)}
        </Text>
      </View>
    </Marker>
  );
}

export const ClusterMarker = memo(ClusterMarkerBase);

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
  },
});
