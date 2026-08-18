import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Cluster, formatBubblePrice, markerColorFor } from '@/lib/cluster';

interface Props {
  cluster: Cluster;
  onPress: (cluster: Cluster) => void;
}

/**
 * A price bubble (single listing) or a count bubble (cluster), used instead of
 * the default pin so the map communicates price at a glance.
 */
function ClusterMarkerBase({ cluster, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          !isCluster && { backgroundColor: markerColorFor(cluster.properties[0].listing_type) },
          isCluster && styles.clusterBubble,
        ]}>
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

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  bubble: {
    backgroundColor: colors.accent,
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
    backgroundColor: colors.primary,
    borderColor: colors.accent,
    borderRadius: 18,
    minWidth: 36,
    paddingHorizontal: 12,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
