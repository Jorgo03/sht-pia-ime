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
import { Property } from '@/data/types';
import {
  formatPrice,
  getLocalizedText,
  listingBadgeKey,
  priceSuffixKey,
} from '@/lib/format';

const IMAGE_SIZE = 108;

/** "1.0" -> "1", "1.5" -> "1.5": baths is numeric(3,1) in Postgres. */
function trimNumber(value: number | string | null | undefined): string | null {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  return String(n);
}

/**
 * Full-width listing row: photo on the left, everything a buyer scans for on
 * the right — what it is, where, size, and price.
 *
 * Exists because Home's "Near you" grid used the 90px mini-card, which shows
 * only price and city. On a phone it collapsed to four thumbnails per line and
 * left out the title, type, rooms, area and whether a listing was for sale or
 * for rent. A list row is the Zillow/Airbnb answer to "compare many homes at a
 * glance": one listing per line, same position for every fact.
 *
 * Price per m² is shown for sales only. It is the number people in this market
 * actually compare apartments by, and it is meaningless for a monthly rent.
 */
function PropertyRowBase({ property }: { property: Property }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(property.id);
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const heartStyle = useHeartPop(favorited);

  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const suffixKey = priceSuffixKey(property.listing_type);
  const price = formatPrice(property.price, i18n.language, property.currency);
  const isSale = property.listing_type === 'sale';
  const area = Number(property.sqft) > 0 ? Number(property.sqft) : null;
  const perSqm =
    isSale && area && Number(property.price) > 0
      ? formatPrice(Number(property.price) / area, i18n.language, property.currency)
      : null;
  const beds = Number(property.beds) > 0 ? Number(property.beds) : null;
  const baths = trimNumber(property.baths);
  // search.<type> holds every property_type the schema allows (apartment,
  // villa, house, commercial, land, office, garage) in all eight locales.
  const typeLabel = property.property_type ? t(`search.${property.property_type}`) : null;
  const place = property.city ?? property.address;

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/property/${property.id}` as Href)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${price}${suffixKey ? t(suffixKey) : ''}, ${place ?? ''}`}>
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: property.image_urls?.[0] }}
            recyclingKey={property.id}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
          <View style={[styles.badge, isSale ? styles.badgeSale : styles.badgeRent]}>
            <Text style={[styles.badgeText, isSale ? styles.badgeTextSale : styles.badgeTextRent]}>
              {t(listingBadgeKey(property.listing_type))}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {[typeLabel, place].filter(Boolean).join(' · ')}
            </Text>
            <TouchableOpacity
              onPress={() => toggle(property.id)}
              hitSlop={12}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: favorited }}
              style={styles.heart}>
              <Animated.View style={heartStyle}>
                <MaterialIcons
                  name={favorited ? 'favorite' : 'favorite-border'}
                  size={18}
                  color={favorited ? colors.accent : colors.textSecondary}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {(beds || baths || area) && (
            <View style={styles.specs}>
              {beds && (
                <View style={styles.spec}>
                  <MaterialIcons name="bed" size={13} color={colors.textSecondary} />
                  <Text style={styles.specText}>{beds}</Text>
                </View>
              )}
              {baths && (
                <View style={styles.spec}>
                  <MaterialIcons name="bathtub" size={13} color={colors.textSecondary} />
                  <Text style={styles.specText}>{baths}</Text>
                </View>
              )}
              {area && (
                <View style={styles.spec}>
                  <MaterialIcons name="square-foot" size={13} color={colors.textSecondary} />
                  <Text style={styles.specText}>{area} m²</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {price}
              {suffixKey ? <Text style={styles.priceSuffix}>{t(suffixKey)}</Text> : null}
            </Text>
            {perSqm && (
              <Text style={styles.perSqm} numberOfLines={1}>
                {perSqm}
                {t('detail.perSqm')}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const PropertyRow = memo(PropertyRowBase);

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: 14,
      padding: 10,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    imageWrap: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.surface2,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    // Sale reads as the brand orange, rent as a neutral glass pill: the two
    // must be told apart at a glance in a long list, not by reading the word.
    badge: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeSale: {
      backgroundColor: colors.accent,
    },
    badgeRent: {
      backgroundColor: 'rgba(20,16,12,0.72)',
    },
    badgeText: {
      fontFamily: Fonts?.sansBold,
      fontSize: 10,
      letterSpacing: 0.3,
    },
    badgeTextSale: {
      color: '#fff',
    },
    badgeTextRent: {
      color: '#faf6ef',
    },
    body: {
      flex: 1,
      paddingVertical: 2,
      justifyContent: 'space-between',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eyebrow: {
      flex: 1,
      fontFamily: Fonts?.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    heart: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glass,
    },
    title: {
      fontFamily: Fonts?.serif,
      fontSize: 15,
      lineHeight: 19,
      color: colors.textPrimary,
      marginTop: 2,
    },
    specs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
    },
    spec: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    specText: {
      fontFamily: Fonts?.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 6,
    },
    price: {
      flexShrink: 1,
      fontFamily: Fonts?.serifSemiBold,
      fontSize: 17,
      color: colors.accent,
    },
    priceSuffix: {
      fontFamily: Fonts?.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    perSqm: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      color: colors.textSecondary,
    },
  });
