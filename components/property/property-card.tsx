import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AtticoColors } from '@/constants/theme';
import { Property } from '@/data/types';
import { useIsFavorite } from '@/hooks/use-favorites';

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
}

export function PropertyCard({ property, onPress }: PropertyCardProps) {
  const { favorited, toggle } = useIsFavorite(property.id);

  const handleFavorite = () => {
    toggle();
  };

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
          onPress={handleFavorite}
          activeOpacity={0.7}
          hitSlop={8}>
          <MaterialIcons
            name={favorited ? 'favorite' : 'favorite-border'}
            size={20}
            color={favorited ? '#ef4444' : '#fff'}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {property.title}
        </Text>
        <Text style={styles.price}>
          ${Number(property.price).toLocaleString()}
          <Text style={styles.priceLabel}>
            /{property.listing_type === 'rent' ? 'mo' : ''}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: AtticoColors.primaryLight,
    margin: 6,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: AtticoColors.accentLight,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
  },
});
