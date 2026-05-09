import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AtticoColors } from '@/constants/theme';
import { getPropertyById } from '@/data/properties';
import { Property } from '@/data/types';
import { useIsFavorite } from '@/hooks/use-favorites';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.42;

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { favorited, toggle: toggleFavorite } = useIsFavorite(id ?? '');
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPropertyById(id ?? '')
      .then(setProperty)
      .finally(() => setLoading(false));
  }, [id]);

  const handleFavorite = () => {
    toggleFavorite();
  };

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={AtticoColors.accentLight} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Property not found</Text>
      </View>
    );
  }

  const amenities = [
    { id: 'bed', name: `${property.beds ?? 0} Beds`, icon: 'bed' },
    { id: 'bath', name: `${property.baths ?? 0} Baths`, icon: 'bathtub' },
    { id: 'sqft', name: `${property.sqft ?? '-'} sqft`, icon: 'square-foot' },
    { id: 'type', name: property.property_type ?? 'N/A', icon: 'home' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: property.image_urls[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
          style={styles.imageOverlay}
        />
        <SafeAreaView style={styles.imageHeader} edges={['top']}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerBrand}>Shtëpia.ime</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleFavorite}
            activeOpacity={0.7}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={24}
              color={favorited ? '#ef4444' : '#fff'}
            />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.name}>{property.title}</Text>
        <View style={styles.locationRow}>
          <MaterialIcons
            name="location-on"
            size={16}
            color={AtticoColors.textSecondary}
          />
          <Text style={styles.location}>
            {property.address}, {property.city}
          </Text>
        </View>

        <Text style={styles.description}>{property.description}</Text>

        <View style={styles.amenityRow}>
          {amenities.map((a) => (
            <View key={a.id} style={styles.amenityItem}>
              <View style={styles.amenityIcon}>
                <MaterialIcons
                  name={a.icon as any}
                  size={22}
                  color={AtticoColors.accent}
                />
              </View>
              <Text style={styles.amenityLabel}>{a.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.price}>
              ${Number(property.price).toLocaleString()}
              <Text style={styles.priceSuffix}>
                {property.listing_type === 'rent' ? '/mo' : ''}
              </Text>
            </Text>
          </View>
        </View>

        <ActionButton
          title="Book Now"
          onPress={() =>
            Alert.alert('Booking', `Booking ${property.title}...`)
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AtticoColors.surface,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AtticoColors.surface,
  },
  errorText: {
    fontSize: 16,
    color: AtticoColors.textDark,
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    backgroundColor: AtticoColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  contentInner: {
    padding: 24,
    paddingBottom: 40,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: AtticoColors.textDark,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  location: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 8,
  },
  amenityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  amenityItem: {
    alignItems: 'center',
    gap: 6,
  },
  amenityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityLabel: {
    fontSize: 12,
    color: AtticoColors.textSecondary,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 13,
    color: AtticoColors.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: AtticoColors.textDark,
  },
  priceSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
  },
});
