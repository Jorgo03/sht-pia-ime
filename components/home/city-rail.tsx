import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { RiseIn, usePressScale } from '@/components/ui/motion';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { cardImageUrl } from '@/lib/image';
import type { CityTile } from '@/src/features/properties/lib/discovery';

const TILE_WIDTH = 148;
const TILE_HEIGHT = 188;

function Tile({ tile, onPress }: { tile: CityTile; onPress: (city: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const homes = t('search.results', { count: tile.count });

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        style={styles.tile}
        onPress={() => onPress(tile.city)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${tile.city}, ${homes}`}>
        {tile.photo ? (
          <Image accessibilityLabel={tile.city} source={{ uri: cardImageUrl(tile.photo, TILE_WIDTH) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        ) : (
          <LinearGradient colors={[colors.accent, colors.accentEnd]} style={[StyleSheet.absoluteFill, styles.noPhoto]}>
            <MaterialIcons name="location-city" size={44} color="rgba(255,255,255,0.55)" />
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(14,11,9,0.86)']} style={styles.shade} />
        <View style={styles.caption}>
          <Text style={styles.city} numberOfLines={1}>{tile.city}</Text>
          <Text style={styles.count} numberOfLines={1}>{homes}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Home's "by city" rail: real photos, live counts, one tap to those homes. */
function CityRailBase({
  tiles,
  loading,
  failed,
  onRetry,
  onSelect,
}: {
  tiles: CityTile[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (city: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (failed) {
    return (
      <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {loading
        ? [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
        : tiles.map((tile, i) => (
            <RiseIn key={tile.city} index={i}>
              <Tile tile={tile} onPress={onSelect} />
            </RiseIn>
          ))}
    </ScrollView>
  );
}

export const CityRail = memo(CityRailBase);

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    rail: { paddingHorizontal: 20, gap: 12 },
    tile: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
      justifyContent: 'flex-end',
    },
    noPhoto: { alignItems: 'center', justifyContent: 'center' },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
    caption: { paddingHorizontal: 14, paddingBottom: 14, gap: 2 },
    city: { fontFamily: Fonts?.serif, fontSize: 21, color: '#fff' },
    count: { fontFamily: Fonts.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
    skeleton: { width: TILE_WIDTH, height: TILE_HEIGHT, borderRadius: 18, backgroundColor: colors.glass },
    retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
    retryText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
  });
