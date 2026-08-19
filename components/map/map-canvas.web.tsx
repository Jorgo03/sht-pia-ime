import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/contexts/theme-context';

import type { MapCanvasHandle, MapCanvasProps } from './map-canvas.types';

/**
 * react-native-maps has no web target — importing it (even transitively,
 * through ClusterMarker/CountyMarker) crashes Metro's web bundle with
 * "Importing native-only module ... on web". This is the web sibling Metro
 * picks up instead via Expo's `.web.tsx` platform-extension convention, so
 * the native map module is never even reached while bundling for web.
 */
function MapCanvasWeb(_props: MapCanvasProps, ref: React.ForwardedRef<MapCanvasHandle>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  useImperativeHandle(ref, () => ({
    // No native map instance to animate on web — a no-op keeps the parent
    // screen's animateToRegion() calls safe to make unconditionally.
    animateToRegion: () => {},
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <MaterialIcons name="map" size={40} color={colors.textSecondary} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('map.webUnavailableTitle', 'Map view')}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('map.webUnavailableHint', 'Interactive map is available in the mobile app. Browse listings as a list instead.')}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/(tabs)/explore')}
        activeOpacity={0.85}>
        <Text style={styles.buttonText}>{t('search.title')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const MapCanvas = forwardRef(MapCanvasWeb);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
