import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { ActionButton } from '@/components/ui/action-button';
import { PrimaryCTA } from '@/components/ui/buttons';
import { ListingAssistant } from '@/components/property/listing-assistant';
import { LocationPreviewMap } from '@/components/property/location-preview-map';
import { PropertyCard } from '@/components/property/property-card';
import { type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useFavorites } from '@/contexts/favorites-context';
import { useTheme } from '@/contexts/theme-context';
import { usePropertiesQuery, usePropertyQuery } from '@/hooks/use-property-queries';
import { addRecentlyViewed } from '@/hooks/use-recently-viewed';
import { useResponsive } from '@/hooks/use-responsive';
import { useTranslatedProperty } from '@/hooks/use-translated-property';
import { logActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { formatPrice, listingBadgeKey, priceSuffixKey, whatsappUrl } from '@/lib/format';

// Rounds "now + 1h" to the next half hour — same default the web app's
// ViewingRequestSheet uses.
function nextSlot(): Date {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: screenHeight, isTablet } = useResponsive();
  const favorited = isFavorite(id ?? '');
  const { data: property = null, isLoading: loading } = usePropertyQuery(id);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [viewingSheetOpen, setViewingSheetOpen] = useState(false);
  const [viewingDate, setViewingDate] = useState<Date>(nextSlot());
  const [viewingNotes, setViewingNotes] = useState('');
  const [requestingViewing, setRequestingViewing] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroListRef = useRef<FlatList<string>>(null);
  const lightboxListRef = useRef<FlatList<string>>(null);
  const screenWidth = Dimensions.get('window').width;
  const { title, description, translating, isTranslated } = useTranslatedProperty(property, i18n.language);

  // Matches PropertyDetail.jsx's mount effect exactly — same two calls, same
  // order, so a mobile visit counts toward the agent's Views stat and shows
  // up in the visitor's Recently Viewed rail. Fires once per property id
  // becoming available, whether that data came from the network or (on a
  // revisit within the cache's staleTime) straight from react-query's cache.
  useEffect(() => {
    if (property?.id) {
      logActivity(property.id, 'view');
      addRecentlyViewed(property.id);
    }
  }, [property?.id]);

  const { data: similarRaw = [] } = usePropertiesQuery(
    { propertyType: property?.property_type ?? null, city: property?.city ?? null },
    8,
    !!property,
  );
  const similar = useMemo(
    () => similarRaw.filter((p) => p.id !== property?.id).slice(0, 4),
    [similarRaw, property?.id],
  );

  const requireSignIn = () => {
    Alert.alert(t('favourites.loginPrompt'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      // common.signIn, not auth.signIn: the auth namespace has signInTitle /
      // signInWith / signInWithEmail but never a bare signIn, so this button
      // rendered the literal text "auth.signIn" in every language.
      { text: t('common.signIn'), onPress: () => router.push('/(tabs)/profile' as Href) },
    ]);
  };

  const agentId = property?.agent?.id || property?.agent_id || property?.owner_id || null;
  const isOwnListing = !!user && !!agentId && user.id === agentId;

  const handleSendMessage = async () => {
    if (!property) return;
    if (!user) return requireSignIn();
    if (!contactMessage.trim() || !agentId || agentId === user.id) return;

    setSendingMessage(true);
    // Matches the web app's startChat(): find-or-create the conversation,
    // then insert the message — same tables, same shape.
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('client_id', user.id)
      .eq('agent_id', agentId)
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ property_id: property.id, client_id: user.id, agent_id: agentId })
        .select('id')
        .single();
      conversationId = created?.id;
    }

    if (conversationId) {
      await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: user.id, body: contactMessage.trim() });
      logActivity(property.id, 'message');
      setContactMessage('');
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 3000);
    } else {
      Alert.alert(t('common.error'), t('errors.generic'));
    }
    setSendingMessage(false);
  };

  const handleShare = () => {
    if (!property) return;
    Share.share({ message: title, url: `https://shtepia.ime/property/${property.id}` }).catch(() => {});
  };

  // Listing-level contact override wins over the agent's own profile phone —
  // matches web's `phone` derivation in PropertyDetail.jsx exactly.
  const contactPhone = property?.contact_phone?.replace(/\s/g, '') || property?.agent?.phone?.replace(/\s/g, '') || null;

  const handleCall = () => {
    if (contactPhone) Linking.openURL(`tel:${contactPhone}`);
  };

  const handleWhatsApp = () => {
    if (!property || !contactPhone) return;
    const message = t('property.whatsappMessage', { title });
    logActivity(property.id, 'message');
    Linking.openURL(whatsappUrl(contactPhone, message));
  };

  const openViewingSheet = () => {
    if (!user) return requireSignIn();
    setViewingDate(nextSlot());
    setViewingNotes('');
    setViewingSheetOpen(true);
  };

  const submitViewingRequest = async () => {
    if (!property || !user) return;
    if (viewingDate.getTime() < Date.now()) {
      Alert.alert(t('common.error'), t('viewings.pastDate'));
      return;
    }
    setRequestingViewing(true);
    const { error } = await supabase.from('viewings').insert({
      property_id: property.id,
      client_id: user.id,
      agent_id: agentId === user.id ? null : agentId,
      scheduled_at: viewingDate.toISOString(),
      notes: viewingNotes.trim() || null,
    });
    setRequestingViewing(false);
    if (error) {
      Alert.alert(t('common.error'), t('viewings.requestFailed'));
      return;
    }
    logActivity(property.id, 'meeting');
    setViewingSheetOpen(false);
    Alert.alert(t('viewings.requestSuccess'));
  };

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
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

  const images = property.image_urls?.length ? property.image_urls : [];
  const price = formatPrice(property.price, i18n.language, property.currency);
  const suffixKey = priceSuffixKey(property.listing_type);
  const suffix = suffixKey ? t(suffixKey) : '';
  // listingBadgeKey() handles all 3 listing types (sale/rent/daily_rent) —
  // a bare rent-only check silently mislabels daily-rent listings as "For
  // Sale", matching the bug already found and fixed on the property cards.
  const badge = t(listingBadgeKey(property.listing_type));
  const propertyTypeLabel = property.property_type ? t(`search.${property.property_type}`) : '';
  const agent = property.agent;
  const agentInitial = agent?.full_name?.[0]?.toUpperCase() || 'A';
  const features = property.features ?? [];
  const pricePerSqm = property.sqft && property.sqft > 0 ? Math.round(property.price / property.sqft) : null;

  const amenities = [
    // *Count keys: property.beds/baths are the form-field labels and have no
    // plural forms, so a 1-bed listing read "1 beds" here too.
    { id: 'bed', name: `${property.beds ?? 0} ${t('property.bedsCount', { count: property.beds ?? 0 })}`, icon: 'bed' },
    { id: 'bath', name: `${property.baths ?? 0} ${t('property.bathsCount', { count: property.baths ?? 0 })}`, icon: 'bathtub' },
    { id: 'sqft', name: `${property.sqft ?? '-'} ${t('property.sqft')}`, icon: 'square-foot' },
    { id: 'type', name: property.property_type ?? 'N/A', icon: 'home' },
    ...(property.year_built
      ? [{ id: 'year', name: `${property.year_built}`, icon: 'calendar-today' }]
      : []),
  ];

  // Split into two content groups so tablet can lay them out as columns
  // (per-brief: gallery full-width, info + agent/contact side by side below)
  // while phone renders the exact same JSX in a single stacked column.
  const infoContent = (
    <>
      <View style={styles.kickerRow}>
        <View style={styles.kickerDash} />
        <Text style={styles.kicker}>
          {badge.toUpperCase()}
          {propertyTypeLabel ? ` · ${propertyTypeLabel.toUpperCase()}` : ''}
        </Text>
      </View>
      <Text style={styles.name}>{title}</Text>
      <View style={styles.locationRow}>
        <MaterialIcons name="location-on" size={16} color={colors.accent} />
        <Text style={styles.location}>
          {property.address}, {property.city}
        </Text>
      </View>

      {translating ? (
        <View style={styles.shimmerGroup}>
          <View style={styles.shimmerLine} />
          <View style={styles.shimmerLine} />
          <View style={[styles.shimmerLine, { width: '70%' }]} />
        </View>
      ) : (
        <>
          <Text style={styles.description}>{description}</Text>
          {isTranslated && (
            <View style={styles.translatedBadge}>
              <MaterialIcons name="language" size={12} color={colors.textSecondary} />
              <Text style={styles.translatedBadgeText}>{t('property.autoTranslated')}</Text>
            </View>
          )}
        </>
      )}

      <View style={styles.amenityRow}>
        {amenities.map((a) => (
          <View key={a.id} style={styles.amenityItem}>
            <View style={styles.amenityIcon}>
              <MaterialIcons name={a.icon as any} size={22} color={colors.accent} />
            </View>
            <Text style={styles.amenityLabel}>{a.name}</Text>
          </View>
        ))}
      </View>

      {features.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="checklist" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>{t('detail.whatsInside')}</Text>
          </View>
          <View style={styles.featuresGrid}>
            {features.map((f) => (
              <View key={f} style={styles.featurePill}>
                <View style={styles.featureDot} />
                <Text style={styles.featurePillText}>{t(`listing.feature.${f}`, f)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {property.latitude != null && property.longitude != null && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="map" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>{t('property.location')}</Text>
          </View>
          <View style={styles.mapPreview} pointerEvents="none">
            <LocationPreviewMap latitude={property.latitude} longitude={property.longitude} />
          </View>
          <TouchableOpacity
            style={styles.openMapsLink}
            onPress={() =>
              Linking.openURL(`https://www.google.com/maps?q=${property.latitude},${property.longitude}`)
            }
            activeOpacity={0.7}>
            <MaterialIcons name="open-in-new" size={14} color={colors.accent} />
            <Text style={styles.openMapsLinkText}>{t('map.openInMaps')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {similar.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="apartment" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>{t('property.similar')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
            {similar.map((p) => (
              <View key={p.id} style={styles.similarCard}>
                <PropertyCard property={p} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );

  const agentAndContactContent = (
    <>
      {agent && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>{t('auth.agent')}</Text>
          </View>
          <TouchableOpacity
            style={styles.agentRow}
            activeOpacity={0.8}
            onPress={() => router.push(`/agent/${agent.id}` as Href)}>
            <View style={styles.agentAvatar}>
              <Text style={styles.agentAvatarText}>{agentInitial}</Text>
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>{agent.full_name || t('auth.agent')}</Text>
              {agent.agency_name ? <Text style={styles.agentRole}>{agent.agency_name}</Text> : null}
            </View>
            {contactPhone ? (
              <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.7}>
                <MaterialIcons name="phone" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </View>
      )}

      {!isOwnListing && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="mail" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>{t('detail.message')}</Text>
          </View>
          <TextInput
            style={[styles.contactInput, styles.contactMessage]}
            placeholder={t('property.whatsappMessage', { title })}
            placeholderTextColor={colors.textSecondary}
            value={contactMessage}
            onChangeText={setContactMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {messageSent ? (
            <Text style={styles.sentConfirm}>{t('detail.message')} ✓</Text>
          ) : (
            <ActionButton
              title={sendingMessage ? t('common.loading') : t('detail.chatInApp')}
              onPress={handleSendMessage}
              disabled={sendingMessage || !contactMessage.trim()}
            />
          )}
          {contactPhone ? (
            <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp} activeOpacity={0.8}>
              <MaterialIcons name="chat" size={18} color={colors.accent} />
              <Text style={styles.whatsappButtonText}>WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.priceLabel}>{t('listing.priceLabel')}</Text>
          <Text style={styles.price}>
            {price}
            <Text style={styles.priceSuffix}>{suffix}</Text>
          </Text>
          {pricePerSqm != null && (
            <Text style={styles.pricePerSqm}>
              ≈ {formatPrice(pricePerSqm, i18n.language, property.currency)}{t('detail.perSqm')}
            </Text>
          )}
        </View>
      </View>

      {!isOwnListing && (
        // Web's sticky CTA is `.cta-pill` (globals.css:229) — 54px gradient
        // pill with the cta shadow and a trailing ArrowRight. ActionButton is
        // a flat accent fill at radius 28 and matched neither.
        <PrimaryCTA label={t('detail.scheduleViewing')} onPress={openViewingSheet} />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {images.length > 0 ? (
          <FlatList
            ref={heroListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setImgIndex(idx);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => setLightboxOpen(true)}
                style={{ width: screenWidth, height: imageHeight }}>
                <Image source={{ uri: item }} style={styles.image} contentFit="cover" transition={300} />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <MaterialIcons name="home" size={48} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageOverlay}
          pointerEvents="none"
        />
        {/* The shared header, floating over the hero rather than above it —
            this screen's gallery is full-bleed, and boxing it under a solid
            bar would cost the image the top of the screen. Language/theme are
            off: share and save are the contextual actions here, and six
            controls don't fit across a phone. */}
        <SafeAreaView style={styles.imageHeader} edges={['top']}>
          <AppHeader
            floating
            showControls={false}
            onBack={() => router.back()}
            trailing={
              <>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleShare}
                  activeOpacity={0.7}>
                  <MaterialIcons name="share" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => toggle(id ?? '')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name={favorited ? 'favorite' : 'favorite-border'}
                    size={24}
                    color={favorited ? colors.accent : '#fff'}
                  />
                </TouchableOpacity>
              </>
            }
          />
        </SafeAreaView>

        {images.length > 1 && (
          images.length <= 8 ? (
            <View style={styles.dotsRow} pointerEvents="none">
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
              ))}
            </View>
          ) : (
            // Past ~8 photos individual dots stop being legible — same
            // compact counter the lightbox below already uses.
            <View style={styles.heroCounter} pointerEvents="none">
              <Text style={styles.heroCounterText}>{imgIndex + 1} / {images.length}</Text>
            </View>
          )
        )}
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

      <Modal visible={viewingSheetOpen} transparent animationType="slide" onRequestClose={() => setViewingSheetOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              {/* requestTitle ("Request a") + requestTitleEm ("viewing") — same
                  two-key split as the web sheet's <h2>, joined with a space
                  since RN Text can't apply <em> styling to a partial string
                  the way the web JSX does. */}
              <Text style={styles.modalTitle}>
                {t('viewings.requestTitle')} {t('viewings.requestTitleEm')}
              </Text>
              <TouchableOpacity onPress={() => setViewingSheetOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>{t('viewings.when')}</Text>
            <DateTimePicker
              value={viewingDate}
              mode="datetime"
              display="spinner"
              minimumDate={nextSlot()}
              onChange={(_event, date) => date && setViewingDate(date)}
              themeVariant="dark"
            />
            <TextInput
              style={[styles.contactInput, styles.contactMessage, { marginTop: 12 }]}
              placeholder={t('addSheet.notes')}
              placeholderTextColor={colors.textSecondary}
              value={viewingNotes}
              onChangeText={setViewingNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {/* Web's ViewingRequestSheet submit is a `.cta-pill` with no
                trailing glyph — hence icon={null}. */}
            <PrimaryCTA
              label={requestingViewing ? t('common.loading') : t('viewings.request')}
              icon={null}
              loading={requestingViewing}
              onPress={submitViewingRequest}
              disabled={requestingViewing}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}>
        <View style={styles.lightboxBackdrop}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxOpen(false)}
            activeOpacity={0.7}
            hitSlop={8}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <FlatList
            ref={lightboxListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={imgIndex}
            getItemLayout={(_data, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
            keyExtractor={(uri, i) => `lightbox-${uri}-${i}`}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setImgIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
            }}
            renderItem={({ item }) => (
              <View style={{ width: screenWidth, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item }} style={styles.lightboxImage} contentFit="contain" />
              </View>
            )}
          />
          {images.length > 1 && (
            <View style={styles.lightboxCounter} pointerEvents="none">
              <Text style={styles.lightboxCounterText}>{imgIndex + 1} / {images.length}</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Web gates this on `status === 'active'` too — a paused/draft/sold
          listing shouldn't invite questions the agent isn't fielding. */}
      {property.status === 'active' && <ListingAssistant property={property} />}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  errorText: {
    fontSize: 16,
    color: colors.textPrimary,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
  imagePlaceholder: {
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#fff',
  },
  heroCounter: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  heroCounterText: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '85%',
  },
  lightboxCounter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lightboxCounterText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    backgroundColor: colors.primary,
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
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  shimmerGroup: {
    gap: 8,
    marginBottom: 8,
  },
  shimmerLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.glass,
  },
  translatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  translatedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  mapPreview: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
  },
  openMapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  openMapsLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
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
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  sectionCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },

  similarRow: {
    gap: 4,
  },
  similarCard: {
    width: 180,
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
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
  agentInfo: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  agentRole: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactInput: {
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactMessage: {
    height: 100,
    paddingTop: 14,
  },
  sentConfirm: {
    textAlign: 'center',
    color: colors.accent,
    fontWeight: '600',
    paddingVertical: 14,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whatsappButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  priceSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  pricePerSqm: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.primaryLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
