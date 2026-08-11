import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { AtticoColors } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { Property } from '@/data/types';
import { useResponsive } from '@/hooks/use-responsive';

export default function FavoritesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { favoriteProperties, loading } = useFavorites();
  const { columns } = useResponsive();

  const renderItem = ({ item }: { item: Property }) => (
    <PropertyCard
      property={item}
      onPress={() => router.push(`/property/${item.id}` as Href)}
    />
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>{t('favourites.title')}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AtticoColors.accent} />
          </View>
        ) : favoriteProperties.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="favorite-border" size={48} color={AtticoColors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('favourites.empty')}</Text>
            <Text style={styles.description}>
              {t('favourites.emptyDescription')}
            </Text>
          </View>
        ) : (
          <FlatList
            key={`cols-${columns}`}
            data={favoriteProperties}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={columns}
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
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  description: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
});
