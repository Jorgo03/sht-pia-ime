import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { LocationPickerProps } from './location-picker.types';

/** Fallback view when a listing has no pin yet. */
const TIRANA: Region = {
  latitude: 41.3275,
  longitude: 19.8187,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/**
 * Tap-to-pin location picker, mirroring the Leaflet pinning the web listing
 * form already has. Without a pin a listing carries null coordinates and is
 * excluded from the map tab entirely, so this is what makes a new listing
 * discoverable there. react-native-maps only ever gets imported from this
 * file (see location-picker.web.tsx for the web sibling) so Metro's web
 * bundle never reaches it.
 */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasPin = latitude != null && longitude != null;

  const region = useMemo<Region>(
    () =>
      hasPin
        ? {
            latitude: latitude as number,
            longitude: longitude as number,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : TIRANA,
    // Only recentre when a pin first appears — recentring on every change
    // would fight the user while they pan to fine-tune the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasPin],
  );

  // Takes a bare coordinate rather than an event, because map presses and
  // marker drags deliver differently-shaped events.
  const setPin = ({ latitude: lat, longitude: lng }: LatLng) => {
    // Six decimals is ~0.1m — well past what a finger tap can express, and it
    // matches the precision the web form stores.
    onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  };

  return (
    <View>
      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          initialRegion={region}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
          userInterfaceStyle="dark"
          toolbarEnabled={false}>
          {hasPin && (
            <Marker
              coordinate={{
                latitude: latitude as number,
                longitude: longitude as number,
              }}
              draggable
              onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
            />
          )}
        </MapView>
      </View>
      <Text style={styles.hint}>
        {hasPin
          ? `${(latitude as number).toFixed(5)}, ${(longitude as number).toFixed(5)}`
          : t('listing.mapHint')}
      </Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  mapWrapper: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: {
    flex: 1,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
