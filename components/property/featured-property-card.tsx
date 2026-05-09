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
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{property.title}</Text>
            <Text style={styles.price}>
              ${Number(property.price).toLocaleString()}
              <Text style={styles.priceLabel}>
                /{property.listing_type === 'rent' ? 'mo' : ''}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={onPress}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>Take a look</Text>
          </TouchableOpacity>
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
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  nameRow: {
    gap: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: AtticoColors.accentLight,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
  },
});
