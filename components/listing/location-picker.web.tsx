import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLeafletMaps } from '@/components/map/leaflet/use-leaflet-maps';
import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { LocationPickerProps } from './location-picker.types';

/**
 * Web sibling of location-picker.native.tsx, with the same layout and rules:
 * tap the map to place the pin, drag it to fine-tune; a chosen road or city
 * (`focus`) only moves the view and never places the pin. The map is Leaflet,
 * loaded in the browser after hydration.
 */
export function LocationPicker({ latitude, longitude, onChange, focus }: LocationPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const maps = useLeafletMaps();
  const hasPin = latitude != null && longitude != null;

  // Six decimals is ~0.1m, the precision the native picker stores.
  const setPin = (lat: number, lng: number) => onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));

  return (
    <View>
      <View style={styles.mapWrapper}>
        {maps ? (
          <maps.PickerMap latitude={latitude} longitude={longitude} focus={focus} onPick={setPin} colors={colors} />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
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

      {hasPin && (
        <Text style={styles.hint}>
          {(latitude as number).toFixed(5)}, {(longitude as number).toFixed(5)}
        </Text>
      )}
    </View>
  );
}

// Same values as location-picker.native.tsx.
const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  mapWrapper: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dragBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radii.pill,
    backgroundColor: colors.surface2,
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
