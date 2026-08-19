import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface Props {
  id: string;
  count: number;
  coordinate: { latitude: number; longitude: number };
  onPress: (id: string) => void;
}

/** The circle badge for a county in the map's region-overview mode — same
 *  visual language as web's .county-marker (accent fill, white ring). */
function CountyMarkerBase({ id, count, coordinate, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={coordinate}
      onPress={() => onPress(id)}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.circle}>
        <Text style={styles.label}>{count}</Text>
      </View>
    </Marker>
  );
}

export const CountyMarker = memo(CountyMarkerBase);

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
