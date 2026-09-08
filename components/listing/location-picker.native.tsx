import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { LocationPickerProps } from './location-picker.types';

/** Fallback view when a listing has no pin yet. */
const TIRANA: Region = {
  latitude: 41.3275,
  longitude: 19.8187,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/** Roughly a few blocks across — close enough to pick out a building, wide
 *  enough that a road's midpoint still shows the street it belongs to. */
const STREET_DELTA = 0.004;

/**
 * Tap-to-pin location picker, mirroring the Leaflet pinning the web listing
 * form already has. Without a pin a listing carries null coordinates and is
 * excluded from the map tab entirely, so this is what makes a new listing
 * discoverable there. react-native-maps only ever gets imported from this
 * file (see location-picker.web.tsx for the web sibling) so Metro's web
 * bundle never reaches it.
 */
export function LocationPicker({ latitude, longitude, onChange, focus }: LocationPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasPin = latitude != null && longitude != null;
  const mapRef = useRef<MapView | null>(null);

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

  /**
   * Fly to a newly chosen road or city.
   *
   * Keyed on the coordinates rather than object identity, so a parent
   * re-render with an equal object does not yank the camera back while the
   * agent is panning. Animated rather than snapped: seeing the map travel is
   * what tells them the road was understood.
   */
  useEffect(() => {
    if (!focus) return;
    mapRef.current?.animateToRegion(
      {
        latitude: focus.latitude,
        longitude: focus.longitude,
        latitudeDelta: STREET_DELTA,
        longitudeDelta: STREET_DELTA,
      },
      650,
    );
    // Depending on `focus` itself would re-run on every parent render that
    // rebuilds the object, snapping the camera back while the agent is
    // panning. The coordinates are the only thing that means "somewhere new".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.latitude, focus?.longitude]);

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
          ref={mapRef}
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

        {/* The drag affordance. A pin that happens to be draggable looks
            exactly like one that is not, and an agent who never discovers it
            publishes whatever the first tap landed on. */}
        {hasPin && (
          <View style={styles.dragBadge} pointerEvents="none">
            <MaterialIcons name="open-with" size={13} color={colors.accent} />
            <Text style={styles.dragBadgeText}>{t('listing.dragMarker')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.instruction}>
        {hasPin ? t('listing.pinAdjustHint') : t('listing.pinOrderHint')}
      </Text>

      {/* Coordinate readout only — with no pin there is nothing to read out,
          and the instruction above has already said what to do. Two lines of
          advice read as one confused one. */}
      {hasPin && (
        <Text style={styles.hint}>
          {(latitude as number).toFixed(5)}, {(longitude as number).toFixed(5)}
        </Text>
      )}
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
  dragBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dragBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  instruction: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.sans,
    color: colors.textSecondary,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
