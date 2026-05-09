import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { AtticoColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getFavorites } from '@/data/favorites';
import { Property } from '@/data/types';

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      getFavorites(user.id)
        .then(setFavorites)
        .finally(() => setLoading(false));
    }, [user]),
  );

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

        {!user ? (
          <View style={styles.center}>
            <Text style={styles.subtitle}>Sign in to see favorites</Text>
            <Text style={styles.description}>
              Go to the Profile tab to sign in
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AtticoColors.accentLight} />
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.subtitle}>No favorites yet</Text>
            <Text style={styles.description}>
              Tap the heart icon on a property to save it
            </Text>
          </View>
        ) : (
          <FlatList
            data={favorites}
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
