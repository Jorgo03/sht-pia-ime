import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useHeartPop, usePressScale } from '@/components/ui/motion';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { useTheme } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { Property } from '@/data/types';
import { formatPrice, getLocalizedText, listingBadgeKey, priceSuffixKey } from '@/lib/format';

/** Matches web's .featured-card__img exactly — a fixed height regardless of
 *  viewport width, not an aspect ratio (src/styles/home.css has no media
 *  query on it). Tablet still caps overall card width so it doesn't stretch
 *  into a near-fullscreen card, an RN-only concession web's CSS doesn't need. */
const IMAGE_HEIGHT = 220;
const MAX_CARD_WIDTH = 420;
const CARD_MARGIN = 20;

interface FeaturedPropertyCardProps {
  property: Property;
  /** Optional — defaults to navigating to /property/${id}, same convention
   *  as PropertyCard's onPress. */
  onPress?: () => void;
}

function FeaturedPropertyCardBase({
  property,
  onPress,
}: FeaturedPropertyCardProps) {
  const { t, i18n } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const router = useRouter();
  const handlePress = onPress ?? (() => router.push(`/property/${property.id}` as Href));
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth, isTablet } = useResponsive();
  const favorited = isFavorite(property.id);
  // Ports polish.css's press compression + heart pop (components/ui/motion).
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const heartStyle = useHeartPop(favorited);
  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const price = formatPrice(property.price, i18n.language, property.currency);
  const suffixKey = priceSuffixKey(property.listing_type);
  const suffix = suffixKey ? t(suffixKey) : '';
  // Matches web's listingBadgeKey() — the badge reads "For Sale"/"For Rent"/
  // "For Daily Rent" (a bare `=== 'rent'` check silently drops daily_rent
  // into "For Sale"), never "Featured" (that label is reserved for the
  // section header above this card, via home.featured/home.editorsPick).
  const badgeLabel = t(listingBadgeKey(property.listing_type));

  const cardWidth = isTablet
    ? Math.min(screenWidth - CARD_MARGIN * 2, MAX_CARD_WIDTH)
    : screenWidth - CARD_MARGIN * 2;

  const handleFavorite = () => toggle(property.id);

  return (
    <Animated.View style={pressStyle}>
    <Pressable
      style={[styles.card, { width: cardWidth }]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: property.image_urls[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel.toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          style={styles.heartButton}
          onPress={handleFavorite}
          activeOpacity={0.7}
          hitSlop={8}>
          <Animated.View style={heartStyle}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={18}
              color={favorited ? colors.accent : '#1a1a1a'}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={14} color={colors.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>
            {property.city ?? property.address}
          </Text>
        </View>
        <View style={styles.statsRow}>
          {!!property.beds && property.beds > 0 && (
            <View style={styles.statChip}>
              <MaterialIcons name="bed" size={14} color={colors.accent} />
              <Text style={styles.statText}>{property.beds} {t('property.bedsCount', { count: property.beds })}</Text>
            </View>
          )}
          <View style={styles.statChip}>
            <MaterialIcons name="bathtub" size={14} color={colors.accent} />
            <Text style={styles.statText}>{property.baths} {t('property.bathsCount', { count: property.baths })}</Text>
          </View>
          <View style={styles.statChip}>
            <MaterialIcons name="square-foot" size={14} color={colors.accent} />
            <Text style={styles.statText}>{property.sqft}{t('property.sqft')}</Text>
          </View>
        </View>
        <Text style={styles.price}>
          {price}{suffix}
        </Text>
      </View>
    </Pressable>
    </Animated.View>
  );
}

export const FeaturedPropertyCard = memo(FeaturedPropertyCardBase);

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    marginHorizontal: CARD_MARGIN,
  },
  imageWrap: {
    height: IMAGE_HEIGHT,
    width: '100%',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heartButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  // Matches web's .featured-card__body — the border wraps only the body,
  // not the image above it (border-top: none), unlike a border around the
  // whole card.
  body: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
  },
  name: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  location: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.glass,
  },
  statText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    fontWeight: '500',
    fontStyle: 'italic',
    color: colors.accent,
  },
});
