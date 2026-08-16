import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useFavorites } from '@/contexts/favorites-context';
import { useResponsive } from '@/hooks/use-responsive';
import { Property } from '@/data/types';
import { formatPrice, getLocalizedText } from '@/lib/format';

/**
 * Phone: card fills the width edge-to-edge (minus margin), same as before.
 * Tablet: filling the width would mean an ~980px-wide, ~1225px-tall card at
 * the 1.25 aspect ratio below — capped so it reads as a hero card, not a
 * near-fullscreen one.
 */
const MAX_CARD_WIDTH = 420;
const CARD_MARGIN = 20;

interface FeaturedPropertyCardProps {
  property: Property;
  onPress: () => void;
}

/**
 * Full-bleed photo hero with a gradient scrim, a mobile-native pattern (web's
 * `.featured-card` puts a flat surface body below the image instead — there's
 * no room for that layout at mobile widths). Chip colors/typography still
 * mirror web's featured-card tokens (mono badge, white heart chip, serif
 * italic orange price) so it reads as the same brand, just a taller format.
 */
export function FeaturedPropertyCard({
  property,
  onPress,
}: FeaturedPropertyCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { isFavorite, toggle } = useFavorites();
  const { width: screenWidth, isTablet } = useResponsive();
  const favorited = isFavorite(property.id);
  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const price = formatPrice(property.price, i18n.language);
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : '';

  const cardWidth = isTablet
    ? Math.min(screenWidth - CARD_MARGIN * 2, MAX_CARD_WIDTH)
    : screenWidth - CARD_MARGIN * 2;
  const cardHeight = cardWidth * 1.25;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { width: cardWidth, height: cardHeight, borderRadius: radii.xl, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.9}>
      <Image
        source={{ uri: property.image_urls[0] }}
        style={styles.image}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { borderRadius: radii.sm }]}>
              <Text style={[styles.badgeText, { fontFamily: fonts.mono }]}>
                {t('property.featured').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.heartButton, { borderRadius: radii.pill }]}
              onPress={() => toggle(property.id)}
              activeOpacity={0.7}>
              <MaterialIcons
                name={favorited ? 'favorite' : 'favorite-border'}
                size={22}
                color={favorited ? colors.orange1 : colors.textOnLight}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.bottom}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { fontFamily: fonts.serif }]}>{title}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={14} color={colors.orange1} />
                <Text style={[styles.location, { fontFamily: fonts.sans }]}>
                  {property.city ?? property.address}
                </Text>
              </View>
            </View>
            <Text style={[styles.price, { fontFamily: fonts.serif, color: colors.orange1 }]}>
              {price}
              <Text style={[styles.priceLabel, { fontFamily: fonts.sans }]}>
                {suffix}
              </Text>
            </Text>
            <View style={styles.statsRow}>
              {property.beds != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="bed" size={16} color={colors.orange1} />
                  <Text style={[styles.statText, { fontFamily: fonts.sansMedium }]}>{property.beds} {t('property.beds')}</Text>
                </View>
              )}
              {property.baths != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="bathtub" size={16} color={colors.orange1} />
                  <Text style={[styles.statText, { fontFamily: fonts.sansMedium }]}>{property.baths} {t('property.baths')}</Text>
                </View>
              )}
              {property.sqft != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="square-foot" size={16} color={colors.orange1} />
                  <Text style={[styles.statText, { fontFamily: fonts.sansMedium }]}>{property.sqft} {t('property.sqft')}</Text>
                </View>
              )}
            </View>
            <LinearGradient
              colors={[colors.orange1, colors.orange2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.button, { borderRadius: radii.pill }]}>
              <TouchableOpacity style={styles.buttonInner} onPress={onPress} activeOpacity={0.8}>
                <Text style={[styles.buttonText, { fontFamily: fonts.sansBold }]}>{t('common.viewAll')}</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    // width/height are computed per-render in the component (see cardWidth
    // above) so they respond to rotation and stay capped on tablet.
    overflow: 'hidden',
    alignSelf: 'center',
    marginHorizontal: CARD_MARGIN,
    borderWidth: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10.5,
    color: '#fff',
    letterSpacing: 1,
  },
  heartButton: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottom: {
    gap: 12,
  },
  nameRow: {
    gap: 4,
  },
  name: {
    fontSize: 24,
    color: '#fff',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: '#eee',
  },
  price: {
    fontSize: 22,
    fontStyle: 'italic',
  },
  priceLabel: {
    fontSize: 13,
    color: '#eee',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#eee',
  },
  button: {
    overflow: 'hidden',
  },
  buttonInner: {
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    color: '#fff',
  },
});
