import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { SearchHeader } from '@/components/ui/search-header';
import { AtticoColors } from '@/constants/theme';
import { getFeaturedProperty, getProperties } from '@/data/properties';
import { Property } from '@/data/types';

export default function HomeScreen() {
  const router = useRouter();
  const [featured, setFeatured] = useState<Property | null>(null);
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFeaturedProperty(), getProperties()])
      .then(([feat, all]) => {
        setFeatured(feat);
        setListings(all.filter((p) => p.id !== feat?.id).slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <SearchHeader title="Find The Perfect Place" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={AtticoColors.accent} />
            </View>
          ) : (
            <>
              {featured && (
                <FeaturedPropertyCard
                  property={featured}
                  onPress={() =>
                    router.push(`/property/${featured.id}` as Href)
                  }
                />
              )}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Popular Listings</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/explore' as Href)}
                    activeOpacity={0.7}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.grid}>
                  {listings.map((item) => (
                    <View key={item.id} style={styles.gridItem}>
                      <PropertyCard
                        property={item}
                        onPress={() =>
                          router.push(`/property/${item.id}` as Href)
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.statsSection}>
                <View style={styles.statCard}>
                  <MaterialIcons name="home" size={28} color={AtticoColors.accent} />
                  <Text style={styles.statNumber}>250+</Text>
                  <Text style={styles.statLabel}>Properties</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="people" size={28} color={AtticoColors.accent} />
                  <Text style={styles.statNumber}>100+</Text>
                  <Text style={styles.statLabel}>Agents</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="star" size={28} color={AtticoColors.accent} />
                  <Text style={styles.statNumber}>4.9</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 24,
  },
  loader: {
    paddingTop: 100,
    alignItems: 'center',
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: AtticoColors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: AtticoColors.textSecondary,
    fontWeight: '500',
  },
});
