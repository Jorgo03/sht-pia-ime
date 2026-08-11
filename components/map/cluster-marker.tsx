import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { AtticoColors } from '@/constants/theme';
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
      <View style={[styles.bubble, isCluster && styles.clusterBubble]}>
        <Text style={styles.label} numberOfLines={1}>
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
    backgroundColor: AtticoColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  clusterBubble: {
    backgroundColor: AtticoColors.primary,
    borderColor: AtticoColors.accent,
    borderRadius: 18,
    minWidth: 36,
    paddingHorizontal: 12,
  },
  label: {
    color: AtticoColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
