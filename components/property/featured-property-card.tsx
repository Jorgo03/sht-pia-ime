import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AtticoColors } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { Property } from '@/data/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 1.25;

interface FeaturedPropertyCardProps {
  property: Property;
  onPress: () => void;
}

export function FeaturedPropertyCard({
  property,
  onPress,
}: FeaturedPropertyCardProps) {
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(property.id);

  return (
    <TouchableOpacity
      style={styles.card}
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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>FEATURED</Text>
            </View>
            <TouchableOpacity
              style={styles.heartButton}
              onPress={() => toggle(property.id)}
              activeOpacity={0.7}>
              <MaterialIcons
                name={favorited ? 'favorite' : 'favorite-border'}
                size={22}
                color={favorited ? AtticoColors.accent : '#fff'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.bottom}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{property.title}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={14} color={AtticoColors.accent} />
                <Text style={styles.location}>
                  {property.city ?? property.address}
                </Text>
              </View>
            </View>
            <Text style={styles.price}>
              ${Number(property.price).toLocaleString()}
              <Text style={styles.priceLabel}>
                {property.listing_type === 'rent' ? '/mo' : ''}
              </Text>
            </Text>
            <View style={styles.statsRow}>
              {property.beds != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="bed" size={16} color={AtticoColors.accent} />
                  <Text style={styles.statText}>{property.beds} Beds</Text>
                </View>
              )}
              {property.baths != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="bathtub" size={16} color={AtticoColors.accent} />
                  <Text style={styles.statText}>{property.baths} Baths</Text>
                </View>
              )}
              {property.sqft != null && (
                <View style={styles.stat}>
                  <MaterialIcons name="square-foot" size={16} color={AtticoColors.accent} />
                  <Text style={styles.statText}>{property.sqft} sqft</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={onPress}
              activeOpacity={0.8}>
              <Text style={styles.buttonText}>Take a look</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
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
    backgroundColor: AtticoColors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  heartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: '#ccc',
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: AtticoColors.accent,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
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
    color: '#ccc',
    fontWeight: '500',
  },
  button: {
    backgroundColor: AtticoColors.accent,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
