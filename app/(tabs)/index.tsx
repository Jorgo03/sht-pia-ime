import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { SearchHeader } from '@/components/ui/search-header';
import { useAuth } from '@/contexts/auth-context';
import { getFeaturedProperty, getProperties } from '@/data/properties';
import { Property } from '@/data/types';
import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useResponsive } from '@/hooks/use-responsive';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { user } = useAuth();
  const { columns } = useResponsive();
  const gridItemWidth = `${100 / columns}%` as const;
  const [featured, setFeatured] = useState<Property | null>(null);
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greetingMorning') : t('home.greetingEvening');
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  useEffect(() => {
    Promise.all([getFeaturedProperty(), getProperties()])
      .then(([feat, all]) => {
        setFeatured(feat);
        setListings(all.filter((p) => p.id !== feat?.id).slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  const title = firstName
    ? `${greeting}, ${firstName}`
    : greeting;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <SearchHeader
          title={title}
          onSearchPress={() => router.push('/(tabs)/explore' as Href)}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.orange1} />
            </View>
          ) : (
            <>
              {featured && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { fontFamily: fonts.serif, color: colors.text }]}>
                      {t('home.featured')}
                    </Text>
                    <Text style={[styles.editorsPick, { fontFamily: fonts.mono, color: colors.textMuted }]}>
                      {t('home.editorsPick')}
                    </Text>
                  </View>
                  <FeaturedPropertyCard
                    property={featured}
                    onPress={() =>
                      router.push(`/property/${featured.id}` as Href)
                    }
                  />
                </>
              )}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { fontFamily: fonts.serif, color: colors.text }]}>
                    {t('home.matched')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/explore' as Href)}
                    activeOpacity={0.7}>
                    <Text style={[styles.seeAll, { fontFamily: fonts.sansSemiBold, color: colors.orange1 }]}>
                      {t('home.seeAll')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.grid}>
                  {listings.map((item) => (
                    <View key={item.id} style={[styles.gridItem, { width: gridItemWidth }]}>
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
                <View style={[styles.statCard, { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialIcons name="home" size={28} color={colors.orange1} />
                  <Text style={[styles.statNumber, { fontFamily: fonts.serif, color: colors.text }]}>250+</Text>
                  <Text style={[styles.statLabel, { fontFamily: fonts.sansMedium, color: colors.textMuted }]}>{t('search.results_other', { count: 250 }).split(' ').pop()}</Text>
                </View>
                <View style={[styles.statCard, { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialIcons name="people" size={28} color={colors.orange1} />
                  <Text style={[styles.statNumber, { fontFamily: fonts.serif, color: colors.text }]}>100+</Text>
                  <Text style={[styles.statLabel, { fontFamily: fonts.sansMedium, color: colors.textMuted }]}>{t('auth.agent')}s</Text>
                </View>
                <View style={[styles.statCard, { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialIcons name="star" size={28} color={colors.orange1} />
                  <Text style={[styles.statNumber, { fontFamily: fonts.serif, color: colors.text }]}>4.9</Text>
                  <Text style={[styles.statLabel, { fontFamily: fonts.sansMedium, color: colors.textMuted }]}>Rating</Text>
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
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 22,
    letterSpacing: -0.3,
  },
  editorsPick: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  seeAll: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    // width is computed per-render (gridItemWidth) so column count can
    // respond to tablet width / rotation instead of being fixed at 2.
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 28,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
  },
});
