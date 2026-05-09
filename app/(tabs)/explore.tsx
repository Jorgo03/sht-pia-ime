import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property/property-card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { GradientBackground } from '@/components/ui/gradient-background';
import { AtticoColors } from '@/constants/theme';
import { getProperties } from '@/data/properties';
import { Property } from '@/data/types';

export default function ExploreScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProperties()
      .then(setProperties)
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }: { item: Property }) => (
    <PropertyCard
      property={item}
      onPress={() => router.push(`/property/${item.id}` as Href)}
    />
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.brand}>Shtëpia.ime</Text>
          <Text style={styles.title}>Find Apartments</Text>
        </View>
        <FilterTabs tabs={['Recommend', 'Nearby']} />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={AtticoColors.accentLight} />
          </View>
        ) : (
          <FlatList
            data={properties}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.row}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  row: {
    gap: 0,
  },
  loader: {
    paddingTop: 100,
    alignItems: 'center',
  },
});
