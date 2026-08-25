import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LocationPicker } from '@/components/listing/location-picker';
import { TranslationBar } from '@/components/listing/translation-bar';
import { ActionButton } from '@/components/ui/action-button';
import { AiTitleButton } from '@/components/ui/ai-title-button';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { translatePropertyContent, type I18nMap } from '@/lib/translate';
import { useListingTranslation } from '@/src/features/listings/hooks/useListingTranslation';
import type { TranslationMeta } from '@/src/lib/translationCore';
import {
  MAX_IMAGES,
  MIN_IMAGES,
  pickImages,
  removeUploadedImages,
  uploadPropertyImages,
  type PickedImage,
} from '@/lib/upload';
// Shared with the web app rather than duplicated — same convention
// components/property/filter-sheet.tsx already uses for its city chips.
import LOCATIONS from '@/src/features/properties/data/locations';

type ListingType = 'sale' | 'rent';
// Mirrors the property_type check constraint on public.properties, same 7
// values web's NewListing.jsx PROPERTY_TYPES offers.
type PropertyType =
  | 'apartment'
  | 'villa'
  | 'house'
  | 'land'
  | 'commercial'
  | 'office'
  | 'garage';
type Currency = 'EUR' | 'ALL' | 'USD';
type Status = 'active' | 'draft';

const PROPERTY_TYPES: { value: PropertyType; icon: string }[] = [
  { value: 'apartment', icon: 'apartment' },
  { value: 'villa', icon: 'villa' },
  { value: 'house', icon: 'home' },
  { value: 'land', icon: 'landscape' },
  { value: 'commercial', icon: 'store' },
  { value: 'office', icon: 'business' },
  { value: 'garage', icon: 'garage' },
];

const CURRENCIES: Currency[] = ['EUR', 'ALL', 'USD'];

// Same source data as filter-sheet.tsx's city chips — a superset of web
// NewListing.jsx's hardcoded 13-city CITIES const, so every city web can
// reach is reachable here too.
const CITIES: string[] = (LOCATIONS as { city: string }[]).map((l) => l.city);

// Same list as web's NewListing.jsx FEATURES_LIST, same i18n keys
// (listing.feature.<name>) — kept in sync with the DB's actual feature set.
const FEATURES_LIST = [
  'balcony',
  'parking',
  'elevator',
  'garden',
  'pool',
  'furnished',
  'airConditioning',
  'heating',
  'security',
  'storage',
] as const;

// properties.sqft/beds/floor/total_floors/year_built are Postgres `integer`
// (±2.14B) — same client-side caps as web's NewListing.jsx so a fat-fingered
// value is caught here instead of surfacing a raw DB error after upload.
const MAX_PRICE = 999_999_999;
const MAX_SQFT = 100_000;
const MAX_BEDS = 50;
const MAX_BATHS = 50;
const MIN_FLOOR = -10;
const MAX_FLOOR = 200;
const MIN_YEAR = 1800;
const MAX_YEAR = new Date().getFullYear() + 2;

function outOfRange(raw: string, min: number, max: number): boolean {
  if (raw === '' || raw == null) return false;
  const n = Number(raw);
  return Number.isNaN(n) || n < min || n > max;
}

interface FormErrors {
  title?: string;
  description?: string;
  city?: string;
  price?: string;
  sqft?: string;
  beds?: string;
  baths?: string;
  floor?: string;
  totalFloors?: string;
  yearBuilt?: string;
  phone?: string;
  submit?: string;
}

interface ListingForm {
  listing_type: ListingType;
  property_type: PropertyType;
  title_i18n: I18nMap;
  description_i18n: I18nMap;
  /** Per-language provenance — see properties.translation_meta. */
  translation_meta: TranslationMeta;
  address: string;
  city: string;
  /** Null until the agent taps the map; excluded from the map tab if unset. */
  latitude: number | null;
  longitude: number | null;
  price: string;
  currency: Currency;
  beds: string;
  baths: string;
  sqft: string;
  floor: string;
  total_floors: string;
  year_built: string;
  features: string[];
  contact_phone: string;
  whatsapp_enabled: boolean;
  contact_email: string;
  status: Status;
}

const INITIAL_FORM: ListingForm = {
  listing_type: 'sale',
  property_type: 'apartment',
  title_i18n: { sq: '' },
  description_i18n: { sq: '' },
  translation_meta: {},
  address: '',
  city: '',
  latitude: null,
  longitude: null,
  price: '',
  currency: 'EUR',
  beds: '',
  baths: '',
  sqft: '',
  floor: '',
  total_floors: '',
  year_built: '',
  features: [],
  contact_phone: '',
  whatsapp_enabled: true,
  contact_email: '',
  status: 'active',
};

export default function CreateListingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const handlePickImages = async () => {
    const { images: picked, oversizedCount } = await pickImages(images.length);
    if (oversizedCount > 0) {
      setImagesError(t('errors.imageTooLarge', { max: 10 }));
    } else if (picked.length > 0) {
      setImagesError(null);
    }
    if (picked.length > 0) setImages((prev) => [...prev, ...picked]);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateI18n = (field: 'title_i18n' | 'description_i18n', lang: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: { ...prev[field], [lang]: value },
    }));

  // One language selection driving both text fields, with caching, staleness
  // and manual-edit protection — shared with the wizard and with web.
  const translation = useListingTranslation<ListingForm>({
    form,
    setForm,
    translate: translatePropertyContent,
  });

  const toggleFeature = (feature: string) =>
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));

  // Mirrors web NewListing.jsx's validate(): the full set of required/range
  // checks the wizard enforces across all its steps before a real publish.
  // A draft skips all of this, same as web's `submit(asDraft)` short-circuit.
  const validateForPublish = (): boolean => {
    const errs: FormErrors = {};
    if (!form.title_i18n.sq?.trim()) errs.title = t('listing.required');
    if (!form.description_i18n.sq?.trim()) errs.description = t('listing.required');
    if (!form.city) errs.city = t('listing.required');

    if (!form.price || Number(form.price) <= 0) errs.price = t('listing.required');
    else if (Number(form.price) > MAX_PRICE) {
      errs.price = t('listing.valueOutOfRange', { min: 0, max: MAX_PRICE.toLocaleString() });
    }

    if (!form.sqft || Number(form.sqft) <= 0) errs.sqft = t('listing.required');
    else if (Number(form.sqft) > MAX_SQFT) {
      errs.sqft = t('listing.valueOutOfRange', { min: 1, max: MAX_SQFT.toLocaleString() });
    }

    if (outOfRange(form.beds, 0, MAX_BEDS)) errs.beds = t('listing.valueOutOfRange', { min: 0, max: MAX_BEDS });
    if (outOfRange(form.baths, 0, MAX_BATHS)) errs.baths = t('listing.valueOutOfRange', { min: 0, max: MAX_BATHS });
    if (outOfRange(form.floor, MIN_FLOOR, MAX_FLOOR)) {
      errs.floor = t('listing.valueOutOfRange', { min: MIN_FLOOR, max: MAX_FLOOR });
    }
    if (outOfRange(form.total_floors, 1, MAX_FLOOR)) {
      errs.totalFloors = t('listing.valueOutOfRange', { min: 1, max: MAX_FLOOR });
    }
    if (outOfRange(form.year_built, MIN_YEAR, MAX_YEAR)) {
      errs.yearBuilt = t('listing.valueOutOfRange', { min: MIN_YEAR, max: MAX_YEAR });
    }

    if (!form.contact_phone?.trim()) errs.phone = t('listing.required');

    setErrors(errs);

    const imagesOk = images.length >= MIN_IMAGES;
    setImagesError(imagesOk ? null : t('listing.minImages'));

    return Object.keys(errs).length === 0 && imagesOk;
  };

  const handleSubmit = async (status: Status) => {
    // Drafts can be finished later — same as web, saving one skips every
    // field check below. A real publish needs the full set.
    if (status === 'active' && !validateForPublish()) return;
    if (!user) {
      Alert.alert(t('common.error'), t('errors.authFailed'));
      return;
    }

    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    let uploadedPaths: string[] = [];
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        setUploadProgress({ done: 0, total: images.length });
        const { urls, paths } = await uploadPropertyImages(images, user.id, (done, total) =>
          setUploadProgress({ done, total }),
        );
        imageUrls = urls;
        uploadedPaths = paths;
        setUploadProgress(null);
      }

      const { error } = await supabase.from('properties').insert({
        // RLS requires owner_id = auth.uid() on insert; agent_id alone isn't
        // enough — every publish from this screen was rejected without it.
        owner_id: user.id,
        agent_id: user.id,
        title: form.title_i18n.sq,
        title_i18n: form.title_i18n,
        description: form.description_i18n.sq || null,
        description_i18n: Object.keys(form.description_i18n).length > 0 ? form.description_i18n : null,
        price: Number(form.price),
        currency: form.currency,
        address: form.address,
        city: form.city || null,
        latitude: form.latitude,
        longitude: form.longitude,
        // This form authors in Albanian and translates outward from it, so sq
        // is the human-written version; every other i18n key is a translation.
        source_language: 'sq',
        // Records which of those keys are machine output and which an agent
        // corrected by hand, so a later edit does not overwrite their work.
        translation_meta: form.translation_meta,
        beds: form.beds ? Number(form.beds) : null,
        baths: form.baths ? Number(form.baths) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        floor: form.floor ? Number(form.floor) : null,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        property_type: form.property_type,
        listing_type: form.listing_type,
        image_urls: imageUrls,
        features: form.features,
        contact_phone: form.contact_phone || null,
        whatsapp_enabled: form.whatsapp_enabled,
        contact_email: form.contact_email || null,
        status,
      });

      if (error) {
        // Upload succeeded but the insert didn't — don't leave the files
        // orphaned in storage.
        await removeUploadedImages(uploadedPaths);
        throw error;
      }

      // A new/updated listing must show up in Explore/Home/Map right away,
      // not after their cache's staleTime quietly expires.
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      Alert.alert(status === 'draft' ? t('listing.saveDraft') : t('listing.publish'), '', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setUploadProgress(null);
      // Mirrors web's friendlySubmitError(): a raw Postgres "out of range"
      // error isn't something an agent can act on, so translate it same as
      // the upload-failure case rather than surfacing the driver message.
      const outOfRangeErr = err?.code === '22003' || /out of range/i.test(err?.message ?? '');
      const message = err?.uploadFailed
        ? t('errors.imageUploadFailed')
        : outOfRangeErr
          ? t('errors.valueOutOfRange')
          : (err?.message ?? t('errors.submitFailed'));
      setErrors((prev) => ({ ...prev, submit: message }));
      Alert.alert(t('common.error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  // Matches web's .nl-section-label — a dash + mono-uppercase label, not a
  // bordered card header. NewListing.jsx has no card chrome around its
  // field groups at all; this is the flat equivalent.
  const SectionLabel = ({ children }: { children: string }) => (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelDash} />
      <Text style={styles.sectionLabelText}>{children.toUpperCase()}</Text>
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('listing.newListing')}</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Listing Type */}
            <View style={styles.field}>
              <SectionLabel>{t('listing.listingType')}</SectionLabel>
              <View style={styles.radioGroup}>
                {(['sale', 'rent'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => updateField('listing_type', type)}
                    activeOpacity={0.85}>
                    {form.listing_type === type ? (
                      <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.radio}>
                        <Text style={[styles.radioText, styles.radioTextActive]}>
                          {type === 'sale' ? t('detail.forSale') : t('detail.forRent')}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.radio}>
                        <Text style={styles.radioText}>
                          {type === 'sale' ? t('detail.forSale') : t('detail.forRent')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Property Type */}
            <View style={styles.field}>
              <SectionLabel>{t('search.propertyType')}</SectionLabel>
              <View style={styles.chipRow}>
                {PROPERTY_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt.value}
                    style={[styles.chip, form.property_type === pt.value && styles.chipActive]}
                    onPress={() => updateField('property_type', pt.value)}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name={pt.icon as any}
                      size={15}
                      color={form.property_type === pt.value ? colors.accent : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        form.property_type === pt.value && styles.chipTextActive,
                      ]}>
                      {t(`search.${pt.value}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title i18n */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('listing.title')}</Text>
                <AiTitleButton
                  details={{
                    listing_type: form.listing_type,
                    property_type: form.property_type,
                    city: form.city,
                    address: form.address,
                    price: form.price,
                    sqft: form.sqft,
                    beds: form.beds,
                    baths: form.baths,
                    notes: form.description_i18n.sq ?? '',
                  }}
                  onResult={(title) => {
                    updateI18n('title_i18n', 'sq', title);
                    translation.selectLanguage('sq');
                  }}
                />
              </View>

              {/* One selector for both fields — selecting a language translates
                  the title and description together, in a single request. */}
              <TranslationBar
                activeLang={translation.activeLang}
                onSelect={translation.selectLanguage}
                filled={(lang) =>
                  !!form.title_i18n[lang]?.trim() || !!form.description_i18n[lang]?.trim()
                }
                pendingLangs={translation.pendingLangs}
                state={translation.state}
                translating={translation.translating}
                error={translation.error}
                onRegenerate={translation.regenerate}
                onRetry={translation.retry}
                canRegenerate={translation.canRegenerate}
              />

              <TextInput
                style={styles.input}
                placeholder={translation.activeLang === 'sq' ? t('listing.titlePlaceholder') : `${t('listing.title')} (${translation.activeLang.toUpperCase()})`}
                placeholderTextColor={colors.textSecondary}
                value={translation.title}
                onChangeText={(val) => {
                  translation.editTitle(val);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Description i18n */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('listing.description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={translation.activeLang === 'sq' ? t('listing.descriptionPlaceholder') : `${t('listing.description')} (${translation.activeLang.toUpperCase()})`}
                placeholderTextColor={colors.textSecondary}
                value={translation.description}
                onChangeText={(val) => {
                  translation.editDescription(val);
                  if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>

            {/* Location */}
            <View style={styles.field}>
              <SectionLabel>{t('listing.address')}</SectionLabel>
              <TextInput
                style={styles.input}
                placeholder={t('listing.addressPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={form.address}
                onChangeText={(val) => updateField('address', val)}
              />
              {/* City is a required facet (map/search filter by exact city
                  match), so it's a picker off the same source list as
                  filter-sheet.tsx rather than free text — same convention,
                  and it removes the typo risk web's own <select> avoids. */}
              <Text style={styles.fieldLabel}>{t('listing.city')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityScroll}>
                {CITIES.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[styles.chip, form.city === city && styles.chipActive]}
                    onPress={() => {
                      updateField('city', city);
                      if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }));
                    }}
                    activeOpacity={0.7}>
                    <Text style={[styles.chipText, form.city === city && styles.chipTextActive]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
              {/* Without a pin the listing is invisible on the map tab, since
                  map queries exclude rows with null coordinates. */}
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) =>
                  setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                }
              />
            </View>

            {/* Photos */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  {t('listing.images')} ({images.length}/{MAX_IMAGES})
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {images.map((img, index) => (
                  <View key={img.uri} style={styles.photoThumb}>
                    <Image source={{ uri: img.uri }} style={styles.photoThumbImage} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => handleRemoveImage(index)}
                      hitSlop={8}
                      activeOpacity={0.7}>
                      <MaterialIcons name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                    {index === 0 && (
                      <View style={styles.photoCoverBadge}>
                        <Text style={styles.photoCoverBadgeText}>{t('listing.cover')}</Text>
                      </View>
                    )}
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity style={styles.photoAdd} onPress={handlePickImages} activeOpacity={0.7}>
                    <MaterialIcons name="add-a-photo" size={22} color={colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.photoHint}>{t('listing.minImages')}</Text>
              {imagesError && <Text style={styles.errorText}>{imagesError}</Text>}
              {uploadProgress && (
                <View style={styles.uploadProgressRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.uploadProgressText}>
                    {t('common.loading')} ({uploadProgress.done}/{uploadProgress.total})
                  </Text>
                </View>
              )}
            </View>

            {/* Price + currency */}
            <View style={styles.rowFields}>
              <View style={[styles.field, styles.flex2]}>
                <Text style={styles.fieldLabel}>{t('listing.price')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={form.listing_type === 'rent' ? `${t('listing.price')} (${t('property.perMonth')})` : t('listing.price')}
                  placeholderTextColor={colors.textSecondary}
                  value={form.price}
                  onChangeText={(val) => {
                    updateField('price', val);
                    if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
              </View>
              <View style={[styles.field, styles.flex1]}>
                <Text style={styles.fieldLabel}>{t('listing.currency')}</Text>
                <View style={styles.chipRow}>
                  {CURRENCIES.map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      style={[styles.chip, form.currency === cur && styles.chipActive]}
                      onPress={() => updateField('currency', cur)}
                      activeOpacity={0.7}>
                      <Text style={[styles.chipText, form.currency === cur && styles.chipTextActive]}>
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Surface */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('listing.surface')} (m²)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={form.sqft}
                onChangeText={(val) => {
                  updateField('sqft', val);
                  if (errors.sqft) setErrors((prev) => ({ ...prev, sqft: undefined }));
                }}
                keyboardType="numeric"
              />
              {errors.sqft && <Text style={styles.errorText}>{errors.sqft}</Text>}
            </View>

            {/* Beds / baths */}
            <View style={styles.rowFields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('property.beds')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={form.beds}
                  onChangeText={(val) => {
                    updateField('beds', val);
                    if (errors.beds) setErrors((prev) => ({ ...prev, beds: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.beds && <Text style={styles.errorText}>{errors.beds}</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('property.baths')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={form.baths}
                  onChangeText={(val) => {
                    updateField('baths', val);
                    if (errors.baths) setErrors((prev) => ({ ...prev, baths: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.baths && <Text style={styles.errorText}>{errors.baths}</Text>}
              </View>
            </View>

            {/* Floor / total floors / year built */}
            <View style={styles.rowFields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('listing.floor')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={form.floor}
                  onChangeText={(val) => {
                    updateField('floor', val);
                    if (errors.floor) setErrors((prev) => ({ ...prev, floor: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.floor && <Text style={styles.errorText}>{errors.floor}</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('listing.totalFloors')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={form.total_floors}
                  onChangeText={(val) => {
                    updateField('total_floors', val);
                    if (errors.totalFloors) setErrors((prev) => ({ ...prev, totalFloors: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.totalFloors && <Text style={styles.errorText}>{errors.totalFloors}</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('listing.yearBuilt')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2024"
                  placeholderTextColor={colors.textSecondary}
                  value={form.year_built}
                  onChangeText={(val) => {
                    updateField('year_built', val);
                    if (errors.yearBuilt) setErrors((prev) => ({ ...prev, yearBuilt: undefined }));
                  }}
                  keyboardType="numeric"
                />
                {errors.yearBuilt && <Text style={styles.errorText}>{errors.yearBuilt}</Text>}
              </View>
            </View>

            {/* Features */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('listing.features')}</Text>
              <View style={styles.chipRow}>
                {FEATURES_LIST.map((feature) => {
                  const active = form.features.includes(feature);
                  return (
                    <TouchableOpacity
                      key={feature}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleFeature(feature)}
                      activeOpacity={0.7}>
                      <View style={[styles.chipDot, active && styles.chipDotActive]} />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(`listing.feature.${feature}`, feature)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Contact */}
            <View style={styles.field}>
              <SectionLabel>{t('listing.contactInfo')}</SectionLabel>
              <Text style={styles.fieldLabel}>{t('listing.phone')}</Text>
              <TextInput
                style={styles.input}
                placeholder="+355 69..."
                placeholderTextColor={colors.textSecondary}
                value={form.contact_phone}
                onChangeText={(val) => {
                  updateField('contact_phone', val);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              <TouchableOpacity
                style={styles.whatsappRow}
                onPress={() => updateField('whatsapp_enabled', !form.whatsapp_enabled)}
                activeOpacity={0.7}>
                <MaterialIcons
                  name={form.whatsapp_enabled ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={form.whatsapp_enabled ? colors.accent : colors.textSecondary}
                />
                <Text style={styles.whatsappLabel}>WhatsApp</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>{t('listing.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="john.doe@gmail.com"
                placeholderTextColor={colors.textSecondary}
                value={form.contact_email}
                onChangeText={(val) => updateField('contact_email', val)}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
            </View>

            {/* Submit */}
            <View style={styles.submitSection}>
              {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}
              <ActionButton
                title={submitting ? t('common.loading') : t('listing.publish')}
                onPress={() => handleSubmit('active')}
                disabled={submitting}
              />
              <ActionButton
                title={t('listing.saveDraft')}
                variant="secondary"
                onPress={() => handleSubmit('draft')}
                disabled={submitting}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },

  // Matches web's flat .nl-field list — no card chrome around groups.
  field: {
    gap: 8,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Matches web's .nl-section-label — dash + mono uppercase, used for the
  // bigger group headers (Listing Type, Property Type, Address, Contact).
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionLabelDash: {
    width: 14,
    height: 1,
    backgroundColor: colors.accent,
  },
  sectionLabelText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Radio group (listing type) — matches web's .nl-radio-group / .nl-radio.
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  radio: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  radioText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  radioTextActive: {
    color: '#fff',
  },

  // Chips — matches web's .nl-chip: tint background when active, not a
  // solid fill, with a small leading dot that switches to accent.
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cityScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
  },
  chipDotActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.accent,
  },

  // Language tabs — matches web's .nl-lang-tab exactly: small pill, mono,
  // solid orange-2 when active (not a big fixed box).
  langTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  langTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  langTabActive: {
    backgroundColor: colors.accentEnd,
    borderColor: 'transparent',
  },
  langTabFilled: {
    borderColor: colors.accentLight,
  },
  langTabText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  langTabTextActive: {
    color: '#fff',
  },

  // Inputs — matches web's .nl-field input exactly (smaller padding/radius
  // than the old card-era input, surface-2-ish background).
  input: {
    backgroundColor: colors.glass,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCoverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accentEnd,
  },
  photoCoverBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadProgressText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Contact
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatsappLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Submit
  submitSection: {
    gap: 12,
    marginTop: 4,
  },
});
