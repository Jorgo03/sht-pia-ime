import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useHeartPop, usePressScale } from '@/components/ui/motion';

import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { useTheme } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { Property } from '@/data/types';
import { formatPrice, getLocalizedText, priceSuffixKey } from '@/lib/format';

const COMPACT_GAP = 12;

/** Matches web's .compact-card: 70% of viewport, floored at 240px — not a
 *  fixed width, so it scales with screen size like the browser does.
 *  Exported so callers (Home's horizontal rail) can compute a matching
 *  `snapToInterval` instead of hand-duplicating this formula. */
export function getCompactCardWidth(screenWidth: number): number {
  return Math.max(screenWidth * 0.7, 240);
}

export function getCompactCardSnapInterval(screenWidth: number): number {
  return getCompactCardWidth(screenWidth) + COMPACT_GAP;
}

interface PropertyCardProps {
  property: Property;
  /** Every call site navigated to the same `/property/${id}` route, so that's
   *  now the default — pass onPress only to override it (e.g. a custom map
   *  preview). Leaving it out means this card never needs a fresh closure
   *  from its parent on every render, which is what actually lets
   *  React.memo below skip re-rendering unchanged rows in a FlatList. */
  onPress?: () => void;
  /** 'compact' mirrors web's PropertyCard variant="compact" — the smaller
   *  card used in horizontal-scroll rails (Matched, Recently Viewed). */
  variant?: 'grid' | 'compact';
}

function PropertyCardBase({ property, onPress, variant = 'grid' }: PropertyCardProps) {
  const { t, i18n } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const router = useRouter();
  const handlePress = onPress ?? (() => router.push(`/property/${property.id}` as Href));
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useResponsive();
  const favorited = isFavorite(property.id);
  // Ports polish.css's press compression + heart pop (see components/ui/motion).
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const heartStyle = useHeartPop(favorited);
  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const price = formatPrice(property.price, i18n.language, property.currency);
  const suffixKey = priceSuffixKey(property.listing_type);
  const suffix = suffixKey ? t(suffixKey) : '';

  if (variant === 'compact') {
    return (
      <Animated.View style={pressStyle}>
      <Pressable
        style={[styles.compactCard, { width: getCompactCardWidth(screenWidth) }]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}>
        <View>
          <Image
            source={{ uri: property.image_urls[0] }}
            style={styles.compactImage}
            contentFit="cover"
            transition={300}
          />
          <TouchableOpacity
            style={styles.compactHeart}
            onPress={() => toggle(property.id)}
            activeOpacity={0.7}
            hitSlop={8}>
            <Animated.View style={heartStyle}>
              <MaterialIcons
                name={favorited ? 'favorite' : 'favorite-border'}
                size={15}
                color={favorited ? colors.accent : '#1a1a1a'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.compactLocationRow}>
            <MaterialIcons name="location-on" size={11} color={colors.textSecondary} />
            <Text style={styles.compactLocation} numberOfLines={1}>
              {property.city ?? property.address}
            </Text>
          </View>
          <View style={styles.compactFooter}>
            {/* Matches web exactly — price and its suffix (e.g. "/mo") share
                one plain text node with no distinct sub-styling. */}
            <Text style={styles.compactPrice}>{price}{suffix}</Text>
            {!!property.beds && property.beds > 0 && (
              <View style={styles.compactBeds}>
                <MaterialIcons name="bed" size={12} color={colors.textSecondary} />
                <Text style={styles.compactBedsText}>{property.beds}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      </Animated.View>
    );
  }

  // Matches web's PropertyCard default ("mini-card") variant exactly —
  // used for Explore's results grid. No badge, no title: just image+heart,
  // then price, then location, in that order. Web's grid card genuinely
  // doesn't show the property title at all; this isn't a simplification,
  // it's what the reference implementation does.
  return (
    <Animated.View style={[styles.cardOuter, pressStyle]}>
    <Pressable
      style={styles.card}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}>
      {/* Matches web's .mini-img — inset within the card's own 8px padding
          with its own smaller radius, not flush with the card edges. */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: property.image_urls[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <TouchableOpacity
          style={styles.heartButton}
          onPress={() => toggle(property.id)}
          activeOpacity={0.7}
          hitSlop={8}>
          <Animated.View style={heartStyle}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={13}
              color={favorited ? colors.accent : '#1a1a1a'}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        {/* Matches web's .mini-price — price and suffix share one plain text
            node with no distinct sub-styling for the suffix. */}
        <Text style={styles.price}>{price}{suffix}</Text>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={11} color={colors.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>
            {property.city ?? property.address}
          </Text>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

export const PropertyCard = memo(PropertyCardBase);

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  // The animated press wrapper has to carry the grid's flex sizing — with
  // `flex: 1` left on the inner card the wrapper would collapse to its
  // content width and break the 2-up grid.
  cardOuter: {
    flex: 1,
  },
  // Matches web's .mini-card: r-md (14px) radius, 8px padding on the whole
  // card (the image sits inset within it, not flush to the card edges).
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 8,
    backgroundColor: colors.primaryLight,
    margin: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Matches web's .mini-img — fixed 90px, its own r-sm (10px) radius, inset
  // within the card's padding rather than sharing the card's own radius.
  imageWrap: {
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Matches .heart-mini: a light translucent circle, not a dark one — the
  // grid card's heart is a different treatment from the compact card's.
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    gap: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  // Matches web's .mini-price — serif, not the plain sans used elsewhere.
  price: {
    fontFamily: Fonts?.serif,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  compactCard: {
    // width is set inline per-render via getCompactCardWidth() — screen
    // width isn't known at StyleSheet-creation time.
    flexShrink: 0,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactImage: {
    width: '100%',
    height: 130,
  },
  compactHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInfo: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // Matches web's .compact-card__title — serif, not the plain sans/600 used
  // elsewhere.
  compactTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 8,
  },
  compactLocation: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Matches web's .compact-card__price — serif 16/500, not 15/700.
  compactPrice: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
  },
  compactBeds: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactBedsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
