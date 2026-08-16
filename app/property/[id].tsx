import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ActionButton } from '@/components/ui/action-button';
import { useFavorites } from '@/contexts/favorites-context';
import { getPropertyById } from '@/data/properties';
import { Property } from '@/data/types';
import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useResponsive } from '@/hooks/use-responsive';
import { formatPrice, getLocalizedText } from '@/lib/format';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const { isFavorite, toggle } = useFavorites();
  const { height: screenHeight, isTablet } = useResponsive();
  const favorited = isFavorite(id ?? '');
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  useEffect(() => {
    getPropertyById(id ?? '')
      .then(setProperty)
      .finally(() => setLoading(false));
  }, [id]);

  const handleContact = () => {
    if (!contactName || !contactEmail || !contactMessage) {
      Alert.alert(t('common.error'), t('errors.fillFields'));
      return;
    }
    Alert.alert('OK', t('detail.message'));
    setContactName('');
    setContactEmail('');
    setContactMessage('');
  };

  if (loading) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.orange1} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { fontFamily: fonts.sans, color: colors.text }]}>
          {t('search.empty')}
        </Text>
      </View>
    );
  }

  // On tablet the image sits above a two-column info split rather than
  // dominating the whole screen, so it can afford to be relatively shorter,
  // leaving more room for that content — especially in landscape, where
  // screenHeight is already constrained.
  const imageHeight = screenHeight * (isTablet ? 0.32 : 0.42);

  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title;
  const description = getLocalizedText(property.description_i18n, i18n.language) || property.description;
  const price = formatPrice(property.price, i18n.language);
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : '';
  const badge = property.listing_type === 'rent' ? t('detail.forRent') : t('detail.forSale');

  const amenities = [
    { id: 'bed', name: `${property.beds ?? 0} ${t('property.beds')}`, icon: 'bed' },
    { id: 'bath', name: `${property.baths ?? 0} ${t('property.baths')}`, icon: 'bathtub' },
    { id: 'sqft', name: `${property.sqft ?? '-'} ${t('property.sqft')}`, icon: 'square-foot' },
    { id: 'type', name: property.property_type ?? 'N/A', icon: 'home' },
  ];

  // Split into two content groups so tablet can lay them out as columns
  // (per-brief: gallery full-width, info + agent/contact side by side below)
  // while phone renders the exact same JSX in a single stacked column.
  const infoContent = (
    <>
      <Text style={[styles.name, { fontFamily: fonts.serif, color: colors.text }]}>{title}</Text>
      <View style={styles.locationRow}>
        <MaterialIcons name="location-on" size={16} color={colors.orange1} />
        <Text style={[styles.location, { fontFamily: fonts.sans, color: colors.textMuted }]}>
          {property.address}, {property.city}
        </Text>
      </View>

      <Text style={[styles.description, { fontFamily: fonts.sans, color: colors.textMuted }]}>
        {description}
      </Text>

      <View style={styles.amenityRow}>
        {amenities.map((a) => (
          <View key={a.id} style={styles.amenityItem}>
            <View
              style={[
                styles.amenityIcon,
                { borderRadius: radii.pill, backgroundColor: colors.orangeTint },
              ]}>
              <MaterialIcons name={a.icon as any} size={22} color={colors.orange1} />
            </View>
            <Text style={[styles.amenityLabel, { fontFamily: fonts.sansMedium, color: colors.textMuted }]}>
              {a.name}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { borderRadius: radii.xl, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="360" size={22} color={colors.orange1} />
          <Text style={[styles.sectionTitle, { fontFamily: fonts.serif, color: colors.text }]}>
            {t('property.video')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.tourPreview, { borderRadius: radii.lg }]}
          activeOpacity={0.8}
          onPress={() => Alert.alert(t('property.video'), t('messages.comingSoon'))}>
          <Image
            source={{ uri: property.image_urls[0] }}
            style={styles.tourImage}
            contentFit="cover"
          />
          <View style={styles.tourOverlay}>
            <View style={[styles.playButton, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}>
              <MaterialIcons name="play-arrow" size={36} color="#fff" />
            </View>
            <Text style={[styles.tourText, { fontFamily: fonts.sansSemiBold }]}>
              {t('property.video')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const agentAndContactContent = (
    <>
      <View style={[styles.sectionCard, { borderRadius: radii.xl, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="person" size={22} color={colors.orange1} />
          <Text style={[styles.sectionTitle, { fontFamily: fonts.serif, color: colors.text }]}>
            {t('auth.agent')}
          </Text>
        </View>
        <View style={styles.agentRow}>
          <View style={[styles.agentAvatar, { borderRadius: radii.pill, backgroundColor: colors.orangeTint }]}>
            <MaterialIcons name="person" size={28} color={colors.orange1} />
          </View>
          <View style={styles.agentInfo}>
            <Text style={[styles.agentName, { fontFamily: fonts.sansSemiBold, color: colors.text }]}>
              {t('auth.agent')}
            </Text>
            <Text style={[styles.agentRole, { fontFamily: fonts.sansMedium, color: colors.orange1 }]}>
              {t('auth.agent')}
            </Text>
            <View style={styles.agentRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialIcons
                  key={star}
                  name="star"
                  size={14}
                  color={star <= 4 ? colors.orange1 : colors.border}
                />
              ))}
              <Text style={[styles.agentRatingText, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                4.0
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.callButton, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}
            onPress={() => Alert.alert(t('property.call'), '...')}
            activeOpacity={0.7}>
            <MaterialIcons name="phone" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.sectionCard, { borderRadius: radii.xl, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="mail" size={22} color={colors.orange1} />
          <Text style={[styles.sectionTitle, { fontFamily: fonts.serif, color: colors.text }]}>
            {t('detail.message')}
          </Text>
        </View>
        <TextInput
          style={[styles.contactInput, { borderRadius: radii.md, backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text, fontFamily: fonts.sans }]}
          placeholder={t('auth.fullName')}
          placeholderTextColor={colors.textFaint}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          style={[styles.contactInput, { borderRadius: radii.md, backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text, fontFamily: fonts.sans }]}
          placeholder={t('auth.email')}
          placeholderTextColor={colors.textFaint}
          value={contactEmail}
          onChangeText={setContactEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[
            styles.contactInput,
            styles.contactMessage,
            { borderRadius: radii.md, backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text, fontFamily: fonts.sans },
          ]}
          placeholder={t('property.whatsappMessage', { title })}
          placeholderTextColor={colors.textFaint}
          value={contactMessage}
          onChangeText={setContactMessage}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <ActionButton title={t('detail.message')} onPress={handleContact} />
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={[styles.priceLabel, { fontFamily: fonts.sans, color: colors.textMuted }]}>
            {t('listing.priceLabel')}
          </Text>
          <Text style={[styles.price, { fontFamily: fonts.serif, color: colors.orange1 }]}>
            {price}
            <Text style={[styles.priceSuffix, { fontFamily: fonts.sans, color: colors.textMuted }]}>
              {suffix}
            </Text>
          </Text>
        </View>
      </View>

      <ActionButton
        title={t('detail.scheduleViewing')}
        onPress={() => Alert.alert(t('detail.scheduleViewing'), title)}
      />
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={{ uri: property.image_urls[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageOverlay}
        />
        <SafeAreaView style={styles.imageHeader} edges={['top']}>
          <TouchableOpacity
            style={[styles.headerButton, { borderRadius: radii.pill }]}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerBrand, { fontFamily: fonts.serifSemiBold }]}>Shtëpia.ime</Text>
          <TouchableOpacity
            style={[styles.headerButton, { borderRadius: radii.pill }]}
            onPress={() => toggle(id ?? '')}
            activeOpacity={0.7}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={24}
              color={favorited ? colors.orange1 : '#fff'}
            />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={[styles.imageBadge, { borderRadius: radii.sm, backgroundColor: colors.orange1 }]}>
          <Text style={[styles.imageBadgeText, { fontFamily: fonts.mono }]}>{badge.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: colors.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl }]}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}>
        {isTablet ? (
          <View style={styles.tabletSplit}>
            <View style={styles.tabletColumnLeft}>{infoContent}</View>
            <View style={styles.tabletColumnRight}>{agentAndContactContent}</View>
          </View>
        ) : (
          <>
            {infoContent}
            {agentAndContactContent}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  imageContainer: {
    // height is computed per-render (imageHeight) so it responds to
    // rotation and differs between phone and tablet proportions.
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 17,
    color: '#fff',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 44,
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  imageBadgeText: {
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    marginTop: -28,
  },
  contentInner: {
    padding: 24,
    paddingBottom: 40,
  },
  // Per the brief's own tablet diagram for this screen: gallery stays
  // full-width above, info + agent/contact split into two columns below.
  // Left carries the longer content (description, amenities), so it gets
  // more width; right is the compact, action-oriented column.
  tabletSplit: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'flex-start',
  },
  tabletColumnLeft: {
    flex: 3,
  },
  tabletColumnRight: {
    flex: 2,
  },
  name: {
    fontSize: 26,
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
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityLabel: {
    fontSize: 12,
  },

  sectionCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
  },

  tourPreview: {
    overflow: 'hidden',
    height: 180,
  },
  tourImage: {
    ...StyleSheet.absoluteFillObject,
  },
  tourOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourText: {
    fontSize: 14,
    color: '#fff',
  },

  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentAvatar: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontSize: 16,
  },
  agentRole: {
    fontSize: 12,
  },
  agentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  agentRatingText: {
    fontSize: 12,
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 1,
  },
  contactMessage: {
    height: 100,
    paddingTop: 14,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
  },
  priceSuffix: {
    fontSize: 14,
  },
});
