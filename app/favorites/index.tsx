import { useAuth } from '@/contexts/auth-context';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '@/contexts/currency-context';
import { cardImageUrl } from '@/lib/image';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { ScreenHero } from '@/components/ui/screen-hero';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts, Radii } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { useTheme } from '@/contexts/theme-context';
import { Property } from '@/data/types';
import { getLocalizedText, priceSuffixKey } from '@/lib/format';
import { useReadableColumn } from '@/hooks/use-responsive';

// Matches web's Favorites.jsx exactly — a vertical list of image+details
// rows (.fav-row), not a property-card grid. Moved out of the tab bar to
// match web, where Favorites lives in the account menu rather than as a
// primary nav destination — reached from Profile's menu list instead, same
// as Messages/Viewings/My Listings.
export default function FavoritesScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { favoriteProperties, loading, error, reload, toggle } = useFavorites();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // A centred column on an unfolded Fold or a spanned Duo (hooks/use-responsive).
  const readable = useReadableColumn();

  // Signed out: ask to sign in, not an empty "nothing yet" screen (website audit).
  if (!user) return authLoading ? null : <SignInPrompt />;
  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        {/* Was a bare "‹ Kthehu te profili" text link floating above the
            kicker, which read as loose body copy rather than chrome. Now the
            same AppHeader every other pushed screen uses (Messages, Viewings,
            My Listings): chevron, centred wordmark, language + theme.
            Still targets /profile explicitly rather than router.back() — this
            screen is reachable from a deep link, where there is no history
            entry to go back to. */}
        <AppHeader onBack={() => router.push('/(tabs)/profile' as Href)} />

        <ScreenHero
          pre={t('favourites.headlinePre')}
          em={t('favourites.headlineEm')}
        />

        {loading ? (
          // Rows in the list's own shape while favourites load.
          <View style={styles.list} accessibilityState={{ busy: true }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, styles.rowSkeleton]} />
            ))}
          </View>
        ) : error && favoriteProperties.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="cloud-off" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('favourites.loadFailed')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryBtn}
              onPress={reload}
              activeOpacity={0.85}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
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
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
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
  // The visitor's chosen currency, as on every card and row.
  const { formatListingPrice } = useCurrency();
  const price = formatListingPrice(property.price, property.currency);
  const suffixKey = priceSuffixKey(property.listing_type);
  const suffix = suffixKey ? t(suffixKey) : '';

  return (
    <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={onTap} activeOpacity={0.85}>
      <View style={styles.rowImageWrap}>
        {property.image_urls?.[0] ? (
          <Image accessibilityLabel={title} source={{ uri: cardImageUrl(property.image_urls[0], 110) }} style={styles.rowImage} contentFit="cover" />
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
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accentText,
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
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  rowSkeleton: {
    height: 98,
    opacity: 0.6,
  },
  rowImageWrap: {
    width: 110,
    height: 80,
    borderRadius: Radii.sm,
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
    color: colors.textPrimary,
  },
  rowLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  rowLoc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  rowPrice: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    color: colors.accentText,
  },
  rowPriceSuffix: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    color: colors.textSecondary,
  },
  rowHeart: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
