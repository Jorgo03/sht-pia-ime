import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AtticoColors } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { Property } from '@/data/types';

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
}

export function PropertyCard({ property, onPress }: PropertyCardProps) {
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(property.id);

  return (
    <TouchableOpacity
      style={styles.card}
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
          style={styles.heartButton}
          onPress={() => toggle(property.id)}
          activeOpacity={0.7}
          hitSlop={8}>
          <MaterialIcons
            name={favorited ? 'favorite' : 'favorite-border'}
            size={20}
            color={favorited ? AtticoColors.accent : '#fff'}
          />
        </TouchableOpacity>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {property.listing_type === 'rent' ? 'RENT' : 'SALE'}
          </Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {property.title}
        </Text>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={12} color={AtticoColors.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>
            {property.city ?? property.address}
          </Text>
        </View>
        <Text style={styles.price}>
          ${Number(property.price).toLocaleString()}
          <Text style={styles.priceLabel}>
            {property.listing_type === 'rent' ? '/mo' : ''}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: AtticoColors.primaryLight,
    margin: 6,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
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
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: AtticoColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  info: {
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    color: AtticoColors.textSecondary,
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: AtticoColors.accent,
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
  },
});
