import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useFavorites } from '@/contexts/favorites-context';
import { Property } from '@/data/types';
import { formatPrice, getLocalizedText } from '@/lib/format';

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
}

/** Mirrors web's `.compact-card`. */
export function PropertyCard({ property, onPress }: PropertyCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(property.id);
  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const price = formatPrice(property.price, i18n.language);
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : '';
  const badgeLabel = property.listing_type === 'rent' ? t('property.forRent') : t('property.forSale');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}>
      <View>
        <Image
          source={{ uri: property.image_urls[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <TouchableOpacity
          style={[styles.heartButton, { borderRadius: radii.pill }]}
          onPress={() => toggle(property.id)}
          activeOpacity={0.7}
          hitSlop={8}>
          <MaterialIcons
            name={favorited ? 'favorite' : 'favorite-border'}
            size={20}
            color={favorited ? colors.orange1 : colors.textOnLight}
          />
        </TouchableOpacity>
        <View style={[styles.badge, { borderRadius: radii.sm, backgroundColor: colors.orange1 }]}>
          <Text style={[styles.badgeText, { fontFamily: fonts.sansBold }]}>
            {badgeLabel.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { fontFamily: fonts.serif, color: colors.text }]}
          numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={12} color={colors.textMuted} />
          <Text style={[styles.location, { fontFamily: fonts.sans, color: colors.textMuted }]} numberOfLines={1}>
            {property.city ?? property.address}
          </Text>
        </View>
        <Text style={[styles.price, { fontFamily: fonts.serif, color: colors.orange1 }]}>
          {price}
          <Text style={[styles.priceLabel, { fontFamily: fonts.sans, color: colors.textMuted }]}>
            {suffix}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    margin: 6,
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: 160,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  info: {
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    flex: 1,
  },
  price: {
    fontSize: 16,
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 11,
  },
});
