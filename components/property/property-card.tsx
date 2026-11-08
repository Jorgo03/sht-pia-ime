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
import { formatPrice, getLocalizedText, listingBadgeKey, priceSuffixKey } from '@/lib/format';
import { cardImageUrl } from '@/lib/image';
import { CARD_CONTAINER_A11Y } from '@/components/property/card-a11y';

const COMPACT_GAP = 12;

/** Matches web's .compact-card: 70% of viewport, floored at 240px — not a
 *  fixed width, so it scales with screen size like the browser does.
 *  Exported so callers (Home's horizontal rail) can compute a matching
 *  `snapToInterval` instead of hand-duplicating this formula. Capped at
 *  COMPACT_MAX_WIDTH: on an unfolded Fold (690 wide) or a spanned Duo (1114)
 *  70% made one card fill the rail under a 130-high photo; the widest phone
 *  (~430) stays under the cap, so phones are unchanged. */
const COMPACT_MAX_WIDTH = 320;

export function getCompactCardWidth(screenWidth: number): number {
  return Math.min(Math.max(screenWidth * 0.7, 240), COMPACT_MAX_WIDTH);
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
  const { width: screenWidth, columns } = useResponsive();
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
        {...CARD_CONTAINER_A11Y}
        style={[styles.compactCard, { width: getCompactCardWidth(screenWidth) }]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}>
        <View>
          <Image
            accessibilityLabel={title}
            source={{ uri: cardImageUrl(property.image_urls[0], getCompactCardWidth(screenWidth)) }}
            // Ties the loaded image to this listing, so a FlatList row reused
            // for a different property cannot flash the previous one.
            recyclingKey={property.id}
            style={styles.compactImage}
            contentFit="cover"
            transition={300}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityState={{ selected: favorited }}
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
          <Text style={styles.compactTitle} numberOfLines={1} accessibilityRole="link" onPress={handlePress}>
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

  // Explore's results grid. The photo carries the listing type (sale/rent);
  // under it come the price, the property type with the place, and the
  // rooms and size — each only when the listing has it, so a sparse listing
  // shows a shorter card rather than zeros or dashes.
  const typeLabel = property.property_type
    ? t(`search.${property.property_type}`, { defaultValue: property.property_type })
    : '';
  const place = property.city ?? property.address;
  const specs = [
    property.beds ? { icon: 'bed' as const, value: String(property.beds) } : null,
    property.baths ? { icon: 'bathtub' as const, value: String(property.baths) } : null,
    property.sqft ? { icon: 'square-foot' as const, value: `${property.sqft} m²` } : null,
  ].filter((x): x is { icon: 'bed' | 'bathtub' | 'square-foot'; value: string } => x !== null);
  const specsLabel = [
    property.beds ? `${property.beds} ${t('property.bedsCount', { count: property.beds })}` : '',
    property.baths ? `${property.baths} ${t('property.bathsCount', { count: property.baths })}` : '',
    property.sqft ? `${property.sqft} m²` : '',
  ].filter(Boolean).join(', ');

  return (
    <Animated.View style={[styles.cardOuter, pressStyle]}>
    <Pressable
      {...CARD_CONTAINER_A11Y}
      style={styles.card}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}>
      {/* Matches web's .mini-img — inset within the card's own 8px padding
          with its own smaller radius, not flush with the card edges. */}
      <View style={styles.imageWrap}>
        <Image
          accessibilityLabel={title}
          source={{ uri: cardImageUrl(property.image_urls[0], screenWidth / columns) }}
          // Ties the loaded image to this listing, so a FlatList row reused
          // for a different property cannot flash the previous one.
          recyclingKey={property.id}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}
          accessibilityState={{ selected: favorited }}
          style={styles.heartButton}
          onPress={() => toggle(property.id)}
          activeOpacity={0.7}
          // 24px drawn; 10 on each side makes the 44px a finger needs.
          hitSlop={10}>
          <Animated.View style={heartStyle}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={13}
              color={favorited ? colors.accent : '#1a1a1a'}
            />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.typeBadge} pointerEvents="none">
          <Text style={styles.typeBadgeText} numberOfLines={1}>
            {t(listingBadgeKey(property.listing_type))}
          </Text>
        </View>
      </View>
      <View style={styles.info}>
        {/* Matches web's .mini-price — price and suffix share one plain text
            node with no distinct sub-styling for the suffix. */}
        <Text
          style={styles.price}
          accessibilityRole="link"
          accessibilityLabel={[title, `${price}${suffix}`, specsLabel].filter(Boolean).join(', ')}
          onPress={handlePress}>
          {price}{suffix}
        </Text>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={11} color={colors.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>
            {[typeLabel, place].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {specs.length > 0 && (
          <View style={styles.specRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {specs.map((sp) => (
              <View key={sp.icon} style={styles.spec}>
                <MaterialIcons name={sp.icon} size={11} color={colors.textSecondary} />
                <Text style={styles.specText}>{sp.value}</Text>
              </View>
            ))}
          </View>
        )}
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
  // 4:3 at every width: the photo is what people choose a home by. The old
  // fixed 90px on phones was a ~2:1 strip that cropped rooms to a band.
  imageWrap: {
    aspectRatio: 4 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  // Sale / rent, on a dark glass chip so it reads on any photo.
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    maxWidth: '70%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,14,0.72)',
  },
  typeBadgeText: {
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
    color: '#fff',
  },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 2,
    marginTop: 3,
  },
  spec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  specText: {
    fontFamily: Fonts?.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
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
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  // Matches web's .mini-price — serif, not the plain sans used elsewhere.
  price: {
    fontFamily: Fonts?.serif,
    fontSize: 14,
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
    fontFamily: Fonts.sans,
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
    color: colors.accentText,
  },
  compactBeds: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactBedsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Fonts.sansMedium,
  },
});
