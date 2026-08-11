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
import { AtticoColors } from '@/constants/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { getPropertyById } from '@/data/properties';
import { Property } from '@/data/types';
import { useResponsive } from '@/hooks/use-responsive';
import { formatPrice, getLocalizedText } from '@/lib/format';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
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
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={AtticoColors.accent} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('search.empty')}</Text>
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
      <Text style={styles.name}>{title}</Text>
      <View style={styles.locationRow}>
        <MaterialIcons name="location-on" size={16} color={AtticoColors.accent} />
        <Text style={styles.location}>
          {property.address}, {property.city}
        </Text>
      </View>

      <Text style={styles.description}>{description}</Text>

      <View style={styles.amenityRow}>
        {amenities.map((a) => (
          <View key={a.id} style={styles.amenityItem}>
            <View style={styles.amenityIcon}>
              <MaterialIcons name={a.icon as any} size={22} color={AtticoColors.accent} />
            </View>
            <Text style={styles.amenityLabel}>{a.name}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="360" size={22} color={AtticoColors.accent} />
          <Text style={styles.sectionTitle}>{t('property.video')}</Text>
        </View>
        <TouchableOpacity
          style={styles.tourPreview}
          activeOpacity={0.8}
          onPress={() => Alert.alert(t('property.video'), t('messages.comingSoon'))}>
          <Image
            source={{ uri: property.image_urls[0] }}
            style={styles.tourImage}
            contentFit="cover"
          />
          <View style={styles.tourOverlay}>
            <View style={styles.playButton}>
              <MaterialIcons name="play-arrow" size={36} color="#fff" />
            </View>
            <Text style={styles.tourText}>{t('property.video')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const agentAndContactContent = (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="person" size={22} color={AtticoColors.accent} />
          <Text style={styles.sectionTitle}>{t('auth.agent')}</Text>
        </View>
        <View style={styles.agentRow}>
          <View style={styles.agentAvatar}>
            <MaterialIcons name="person" size={28} color={AtticoColors.accent} />
          </View>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>{t('auth.agent')}</Text>
            <Text style={styles.agentRole}>{t('auth.agent')}</Text>
            <View style={styles.agentRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialIcons
                  key={star}
                  name="star"
                  size={14}
                  color={star <= 4 ? AtticoColors.accent : '#333'}
                />
              ))}
              <Text style={styles.agentRatingText}>4.0</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Alert.alert(t('property.call'), '...')}
            activeOpacity={0.7}>
            <MaterialIcons name="phone" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="mail" size={22} color={AtticoColors.accent} />
          <Text style={styles.sectionTitle}>{t('detail.message')}</Text>
        </View>
        <TextInput
          style={styles.contactInput}
          placeholder={t('auth.fullName')}
          placeholderTextColor={AtticoColors.textSecondary}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          style={styles.contactInput}
          placeholder={t('auth.email')}
          placeholderTextColor={AtticoColors.textSecondary}
          value={contactEmail}
          onChangeText={setContactEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.contactInput, styles.contactMessage]}
          placeholder={t('property.whatsappMessage', { title })}
          placeholderTextColor={AtticoColors.textSecondary}
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
          <Text style={styles.priceLabel}>{t('listing.priceLabel')}</Text>
          <Text style={styles.price}>
            {price}
            <Text style={styles.priceSuffix}>{suffix}</Text>
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
    <View style={styles.container}>
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
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerBrand}>Shtëpia.ime</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => toggle(id ?? '')}
            activeOpacity={0.7}>
            <MaterialIcons
              name={favorited ? 'favorite' : 'favorite-border'}
              size={24}
              color={favorited ? AtticoColors.accent : '#fff'}
            />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.imageBadge}>
          <Text style={styles.imageBadgeText}>{badge.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
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
    backgroundColor: AtticoColors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AtticoColors.primary,
  },
  errorText: {
    fontSize: 16,
    color: AtticoColors.textPrimary,
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
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  imageBadge: {
    position: 'absolute',
    bottom: 44,
    left: 20,
    backgroundColor: AtticoColors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  imageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    backgroundColor: AtticoColors.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    fontWeight: '700',
    color: AtticoColors.textPrimary,
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
    color: AtticoColors.textSecondary,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: AtticoColors.textSecondary,
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
    borderRadius: 24,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityLabel: {
    fontSize: 12,
    color: AtticoColors.textSecondary,
    fontWeight: '500',
  },

  sectionCard: {
    backgroundColor: AtticoColors.primaryLight,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },

  tourPreview: {
    borderRadius: 16,
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
    borderRadius: 30,
    backgroundColor: AtticoColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 26,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
  },
  agentRole: {
    fontSize: 12,
    color: AtticoColors.accent,
    fontWeight: '500',
  },
  agentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  agentRatingText: {
    fontSize: 12,
    color: AtticoColors.textSecondary,
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AtticoColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactInput: {
    backgroundColor: AtticoColors.glass,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: AtticoColors.textPrimary,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
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
    color: AtticoColors.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: AtticoColors.accent,
  },
  priceSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: AtticoColors.textSecondary,
  },
});
