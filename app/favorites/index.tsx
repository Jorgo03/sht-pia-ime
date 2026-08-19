import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { useTheme } from '@/contexts/theme-context';
import { Property } from '@/data/types';
import { formatPrice, getLocalizedText, priceSuffixKey } from '@/lib/format';

// Matches web's Favorites.jsx exactly — a vertical list of image+details
// rows (.fav-row), not a property-card grid. Moved out of the tab bar to
// match web, where Favorites lives in the account menu rather than as a
// primary nav destination — reached from Profile's menu list instead, same
// as Messages/Viewings/My Listings.
export default function FavoritesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { favoriteProperties, loading, toggle } = useFavorites();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.push('/(tabs)/profile' as Href)}
          hitSlop={8}>
          <MaterialIcons name="chevron-left" size={16} color={colors.textSecondary} />
          <Text style={styles.backLinkText}>{t('favourites.backToProfile').replace('← ', '')}</Text>
        </TouchableOpacity>

        <View style={styles.heroBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDash} />
            <Text style={styles.kicker}>
              {loading ? t('common.loading') : t('favourites.savedCount', { count: favoriteProperties.length })}
            </Text>
          </View>
          <Text style={styles.headline}>
            {t('favourites.headlinePre')} <Text style={styles.headlineEm}>{t('favourites.headlineEm')}</Text>
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : favoriteProperties.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="favorite-border" size={40} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>{t('favourites.empty')}</Text>
          </View>
        ) : (
          <FlatList
            data={favoriteProperties}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <FavRow
                property={item}
                lang={i18n.language}
                onUnsave={() => toggle(item.id)}
                onTap={() => router.push(`/property/${item.id}` as Href)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function FavRow({
  property,
  lang,
  onUnsave,
  onTap,
}: {
  property: Property;
  lang: string;
  onUnsave: () => void;
  onTap: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const title = getLocalizedText(property.title_i18n, lang) || property.title;
  const price = formatPrice(property.price, lang, property.currency);
  const suffixKey = priceSuffixKey(property.listing_type);
  const suffix = suffixKey ? t(suffixKey) : '';

  return (
    <TouchableOpacity style={styles.row} onPress={onTap} activeOpacity={0.85}>
      <View style={styles.rowImageWrap}>
        {property.image_urls?.[0] ? (
          <Image source={{ uri: property.image_urls[0] }} style={styles.rowImage} contentFit="cover" />
        ) : (
          <View style={[styles.rowImage, styles.rowImagePlaceholder]} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.rowLocRow}>
          <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
          <Text style={styles.rowLoc} numberOfLines={1}>{property.city ?? property.address}</Text>
        </View>
        <Text style={styles.rowPrice}>
          {price}
          <Text style={styles.rowPriceSuffix}>{suffix}</Text>
        </Text>
      </View>
      <TouchableOpacity
        style={styles.rowHeart}
        onPress={(e) => {
          e.stopPropagation();
          onUnsave();
        }}
        hitSlop={8}
        accessibilityLabel={t('favourites.remove')}>
        <MaterialIcons name="favorite" size={18} color={colors.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backLinkText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Matches web's .screen-kicker / .screen-headline exactly.
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  kickerDash: {
    width: 14,
    height: 1,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '600',
  },
  headline: {
    fontFamily: Fonts?.serif,
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  headlineEm: {
    fontStyle: 'italic',
    color: colors.accent,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  // Matches web's .fav-row exactly: a bordered card, thumbnail + body + a
  // plain (not circled) heart button — not a property-card grid.
  row: {
    flexDirection: 'row',
    gap: 14,
    padding: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    alignItems: 'center',
  },
  rowImageWrap: {
    width: 110,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  rowImagePlaceholder: {
    backgroundColor: colors.glass,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  rowLoc: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  rowPrice: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
  },
  rowPriceSuffix: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  rowHeart: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
