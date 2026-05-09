import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { AtticoColors } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { Property } from '@/data/types';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoriteProperties, loading } = useFavorites();

  const renderItem = ({ item }: { item: Property }) => (
    <PropertyCard
      property={item}
      onPress={() => router.push(`/property/${item.id}` as Href)}
    />
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Favorites</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AtticoColors.accentLight} />
          </View>
        ) : favoriteProperties.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.subtitle}>No favorites yet</Text>
            <Text style={styles.description}>
              Tap the heart icon on a property to save it
            </Text>
          </View>
        ) : (
          <FlatList
            data={favoriteProperties}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
  },
  description: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
});
