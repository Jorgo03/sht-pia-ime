import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

import type { LocationPickerProps } from './location-picker.types';

/**
 * Web sibling of location-picker.native.tsx — react-native-maps has no web
 * target, so tap-to-pin isn't available here. Coordinates stay settable
 * (not silently dropped) via plain numeric fields, same precision and same
 * onChange contract as the native picker.
 *
 * `focus` is accepted and ignored: it exists to move a camera, and there is no
 * camera here. Nothing is prefilled from it either — a road's midpoint is not
 * the property, and writing it into these boxes would publish that guess as
 * the address. This is the Expo-web fallback; the Vite web app has its own
 * Leaflet picker.
 */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasPin = latitude != null && longitude != null;

  const commit = (lat: string, lng: string) => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      onChange(Number(parsedLat.toFixed(6)), Number(parsedLng.toFixed(6)));
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('listing.latitude', 'Latitude')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="41.3275"
            placeholderTextColor={colors.textSecondary}
            defaultValue={latitude != null ? String(latitude) : ''}
            onChangeText={(v) => commit(v, longitude != null ? String(longitude) : '0')}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('listing.longitude', 'Longitude')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="19.8187"
            placeholderTextColor={colors.textSecondary}
            defaultValue={longitude != null ? String(longitude) : ''}
            onChangeText={(v) => commit(latitude != null ? String(latitude) : '0', v)}
          />
        </View>
      </View>
      {/* Readout only. The old fallback here told the reader to tap the map —
          on the one variant that has no map to tap. With the boxes empty they
          are their own instruction. */}
      {hasPin && (
        <Text style={styles.hint}>
          {(latitude as number).toFixed(5)}, {(longitude as number).toFixed(5)}
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
