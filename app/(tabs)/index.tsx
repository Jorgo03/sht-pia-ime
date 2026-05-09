import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { SearchHeader } from '@/components/ui/search-header';
import { AtticoColors } from '@/constants/theme';
import { getFeaturedProperty } from '@/data/properties';
import { Property } from '@/data/types';

export default function HomeScreen() {
  const router = useRouter();
  const [featured, setFeatured] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedProperty()
      .then(setFeatured)
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
              <ActivityIndicator size="large" color={AtticoColors.accentLight} />
            </View>
          ) : featured ? (
            <FeaturedPropertyCard
              property={featured}
              onPress={() =>
                router.push(`/property/${featured.id}` as Href)
              }
            />
          ) : null}
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
});
