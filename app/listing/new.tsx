import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationPicker } from '@/components/listing/location-picker';
import { TranslationBar } from '@/components/listing/translation-bar';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { Chip, SectionLabel } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { GradientBackground } from '@/components/ui/gradient-background';
import { RiseIn } from '@/components/ui/motion';
import { SelectField } from '@/components/ui/select-field';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { translatePropertyContent, type I18nMap } from '@/lib/translate';
import { useListingTranslation } from '@/src/features/listings/hooks/useListingTranslation';
import type { TranslationMeta } from '@/src/lib/translationCore';
import {
  MAX_IMAGES,
  MAX_VIDEO_MB,
  MIN_IMAGES,
  pickImages,
  pickVideo,
  removeUploadedImages,
  uploadPropertyImages,
  uploadPropertyVideo,
  type PickedImage,
  type PickedVideo,
} from '@/lib/upload';
import LOCATIONS from '@/src/features/properties/data/locations';

/**
 * Multi-step listing wizard — the native counterpart to web's
 * src/features/listings/pages/NewListing.jsx.
 *
 * Same five steps, same per-step validation, same insert payload and same
 * draft-restore behaviour, so a listing is identical whichever app created it.
 * `listing/create.tsx` remains the single-scroll form and is untouched; this
 * route is additive until the wizard is confirmed against real submissions.
 *
 * Two deliberate divergences from the design handoff's §13 sketch:
 *  - Five steps, not four. Web already ships basics/location/details/media/
 *    publish and the `listing.step.*` keys exist in all eight locales; a
 *    merged "photos & details" step would need new keys everywhere and would
 *    put nine inputs plus a photo grid on one phone screen.
 *  - Status stays `active`/`draft`, never `pending_review`. There is no review
 *    queue UI yet (Super Admin is a planned role), so defaulting to
 *    pending_review would strand every new listing invisible with nobody able
 *    to approve it — the call already recorded in DECISIONS.md (MP2). There is
 *    no `published` status on this schema at all; the public one is `active`.
 */

const STEPS = ['basics', 'location', 'details', 'media', 'publish'] as const;

type ListingType = 'sale' | 'rent';
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

// daily_rent is display-only — removed from creation on web by owner decision
// (2026-07-14), so it stays out here too.
const LISTING_TYPES: ListingType[] = ['sale', 'rent'];

const PROPERTY_TYPES: PropertyType[] = [
  'apartment',
  'villa',
  'house',
  'land',
  'commercial',
  'office',
  'garage',
];

const CURRENCIES: Currency[] = ['EUR', 'ALL', 'USD'];

const CITIES: string[] = (LOCATIONS as { city: string }[]).map((l) => l.city);

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

// Same client-side caps as web — properties.sqft/beds/floor/total_floors/
// year_built are Postgres `integer`, so a fat-fingered value is caught on the
// step that owns it rather than as a raw DB error after the photos upload.
const MAX_PRICE = 999_999_999;
const MAX_SQFT = 100_000;
const MAX_BEDS = 50;
const MAX_BATHS = 50;
const MIN_FLOOR = -10;
const MAX_FLOOR = 200;
const MIN_YEAR = 1800;
const MAX_YEAR = new Date().getFullYear() + 2;

const DRAFT_KEY = 'fho_listing_draft_v1';

function outOfRange(raw: string, min: number, max: number): boolean {
  if (!raw) return false;
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
  total_floors?: string;
  year_built?: string;
  images?: string;
  video?: string;
  phone?: string;
  submit?: string;
}

interface ListingForm {
  listing_type: ListingType;
  property_type: PropertyType;
  title_i18n: I18nMap;
  description_i18n: I18nMap;
  /**
   * Per-language provenance for the two maps above — which Albanian source a
   * translation came from, and whether a human has since edited it. Persisted
   * to properties.translation_meta so the distinction survives a reload.
   */
  translation_meta: TranslationMeta;
  address: string;
  city: string;
  /** Null until the agent taps the map; such rows are excluded from the map tab. */
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
};

export default function NewListingWizard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // First paint waits on the draft read so a restore can never land on top of
  // something the agent already typed. It's one AsyncStorage get.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!cancelled && raw) {
          const draft = JSON.parse(raw) as { form?: Partial<ListingForm>; step?: number };
          if (draft?.form) {
            setForm({ ...INITIAL_FORM, ...draft.form });
            setStep(Math.min(Math.max(draft.step ?? 0, 0), STEPS.length - 1));
            setDraftRestored(true);
          }
        }
      } catch {
        /* unreadable draft — start clean rather than block the wizard */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist progress on every change. Photos and video hold local file URIs
  // that don't survive a restart, so — exactly like web — only the form and
  // the step are saved and media is re-added after a restore.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, savedAt: Date.now() })).catch(
      () => {
        /* storage full/blocked — the wizard still works, just unsaved */
      },
    );
  }, [form, step, hydrated]);

  const discardDraft = () => {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    setForm(INITIAL_FORM);
    setStep(0);
    setImages([]);
    setVideo(null);
    setErrors({});
    setDraftRestored(false);
  };

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Owns the language selection for BOTH text fields, plus everything that
  // makes selecting one safe: the per-language cache, staleness against the
  // Albanian source, protection for hand-edited translations, and discarding
  // superseded responses. Shared verbatim with web's NewListing.jsx.
  const translation = useListingTranslation<ListingForm>({
    form,
    setForm,
    translate: translatePropertyContent,
  });

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const toggleFeature = (feature: string) =>
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));

  // Per-step gate, field-for-field the same as web's validate().
  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (step === 0) {
      if (!form.title_i18n.sq?.trim()) errs.title = t('listing.required');
      if (!form.description_i18n.sq?.trim()) errs.description = t('listing.required');
    }
    if (step === 1) {
      if (!form.city) errs.city = t('listing.required');
    }
    if (step === 2) {
      if (!form.price || Number(form.price) <= 0) errs.price = t('listing.required');
      else if (Number(form.price) > MAX_PRICE) {
        errs.price = t('listing.valueOutOfRange', { min: 0, max: MAX_PRICE.toLocaleString() });
      }

      if (!form.sqft || Number(form.sqft) <= 0) errs.sqft = t('listing.required');
      else if (Number(form.sqft) > MAX_SQFT) {
        errs.sqft = t('listing.valueOutOfRange', { min: 1, max: MAX_SQFT.toLocaleString() });
      }

      if (outOfRange(form.beds, 0, MAX_BEDS)) {
        errs.beds = t('listing.valueOutOfRange', { min: 0, max: MAX_BEDS });
      }
      if (outOfRange(form.baths, 0, MAX_BATHS)) {
        errs.baths = t('listing.valueOutOfRange', { min: 0, max: MAX_BATHS });
      }
      if (outOfRange(form.floor, MIN_FLOOR, MAX_FLOOR)) {
        errs.floor = t('listing.valueOutOfRange', { min: MIN_FLOOR, max: MAX_FLOOR });
      }
      if (outOfRange(form.total_floors, 1, MAX_FLOOR)) {
        errs.total_floors = t('listing.valueOutOfRange', { min: 1, max: MAX_FLOOR });
      }
      if (outOfRange(form.year_built, MIN_YEAR, MAX_YEAR)) {
        errs.year_built = t('listing.valueOutOfRange', { min: MIN_YEAR, max: MAX_YEAR });
      }
    }
    if (step === 3) {
      if (images.length < MIN_IMAGES) errs.images = t('listing.minImages');
    }
    if (step === 4) {
      if (!form.contact_phone?.trim()) errs.phone = t('listing.required');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validate()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prev = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const handlePickImages = async () => {
    const { images: picked, oversizedCount } = await pickImages(images.length);
    if (oversizedCount > 0) {
      setErrors((p) => ({ ...p, images: t('errors.imageTooLarge', { max: 10 }) }));
    } else if (picked.length > 0) {
      clearError('images');
    }
    if (picked.length > 0) setImages((prev) => [...prev, ...picked]);
  };

  const handlePickVideo = async () => {
    const { video: picked, rejected } = await pickVideo();
    if (rejected === 'type') {
      setErrors((p) => ({ ...p, video: t('errors.videoInvalidType') }));
      return;
    }
    if (rejected === 'size') {
      setErrors((p) => ({ ...p, video: t('errors.videoTooLarge', { max: MAX_VIDEO_MB }) }));
      return;
    }
    if (picked) {
      clearError('video');
      setVideo(picked);
    }
  };

  const submit = async (status: Status) => {
    // A draft can be finished later, so it skips the remaining step gates —
    // same short-circuit as web's submit(asDraft).
    if (status === 'active' && !validate()) return;
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
      }

      // Video rides the same all-or-nothing rule as the photos.
      let videoUrl: string | null = null;
      if (video) {
        try {
          const uploaded = await uploadPropertyVideo(video, user.id);
          videoUrl = uploaded.url;
          uploadedPaths.push(uploaded.path);
        } catch (err) {
          await removeUploadedImages(uploadedPaths);
          throw err;
        }
      }
      setUploadProgress(null);

      // Only an agent's own listing carries an agent_id — a client-posted one
      // must not claim agent attribution (same rule as web).
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const isAgent = profile?.role === 'agent';

      const { error } = await supabase.from('properties').insert({
        // RLS requires owner_id = auth.uid() on insert.
        owner_id: user.id,
        agent_id: isAgent ? user.id : null,
        owner_type: isAgent ? 'agent' : 'client',
        title: form.title_i18n.sq || '',
        title_i18n: form.title_i18n,
        description: form.description_i18n.sq || '',
        description_i18n: form.description_i18n,
        // This form authors in Albanian and translates outward from it.
        source_language: 'sq',
        // Carries which languages are machine-translated and which an agent
        // edited, so reopening the listing later does not re-translate over
        // their corrections or re-bill for work already done.
        translation_meta: form.translation_meta,
        listing_type: form.listing_type,
        property_type: form.property_type,
        city: form.city || null,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        price: Number(form.price) || 0,
        currency: form.currency,
        sqft: Number(form.sqft) || 0,
        beds: Number(form.beds) || 0,
        baths: Number(form.baths) || 0,
        floor: form.floor ? Number(form.floor) : null,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        features: form.features,
        video_url: videoUrl,
        image_urls: imageUrls,
        contact_phone: form.contact_phone || null,
        whatsapp_enabled: form.whatsapp_enabled,
        contact_email: form.contact_email || null,
        status,
      });

      // Insert failed after upload succeeded — don't leave orphaned files.
      if (error) {
        await removeUploadedImages(uploadedPaths);
        throw error;
      }

      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      // The new listing must appear in Explore/Home/Map immediately, not once
      // their cache's staleTime quietly expires.
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.replace('/my-listings');
    } catch (err: any) {
      setUploadProgress(null);
      // A raw Postgres "out of range" isn't something an agent can act on.
      const outOfRangeErr = err?.code === '22003' || /out of range/i.test(err?.message ?? '');
      const message = err?.uploadFailed
        ? t('errors.imageUploadFailed')
        : outOfRangeErr
          ? t('errors.valueOutOfRange')
          : (err?.message ?? t('errors.submitFailed'));
      setErrors((prev) => ({ ...prev, submit: message }));
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------------------------------------------- steps */

  const renderBasics = () => (
    <>
      <View style={styles.fieldBlock}>
        <SectionLabel label={t('listing.listingType')} />
        <View style={styles.radioGroup}>
          {LISTING_TYPES.map((lt) => {
            const active = form.listing_type === lt;
            return (
              <Pressable
                key={lt}
                style={styles.radioWrap}
                onPress={() => update('listing_type', lt)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && (
                    <LinearGradient
                      colors={[colors.accent, colors.accentEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <Text style={[styles.radioText, active && styles.radioTextActive]}>
                    {t(`listing.type.${lt}`)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Labeled styles={styles} label={t('search.propertyType')}>
        <SelectField
          value={form.property_type}
          options={PROPERTY_TYPES.map((pt) => ({ value: pt, label: t(`search.${pt}`) }))}
          placeholder={t('search.propertyType')}
          icon="home-work"
          onChange={(v) => update('property_type', v as PropertyType)}
        />
      </Labeled>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('listing.title')}</Text>

        {/* One selector for both fields: tapping a language translates the
            title and description together, in a single request. */}
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
          placeholder={
            translation.activeLang === 'sq'
              ? t('listing.titlePlaceholder')
              : `${t('listing.title')} (${translation.activeLang.toUpperCase()})`
          }
          placeholderTextColor={colors.textSecondary}
          value={translation.title}
          onChangeText={(val) => {
            translation.editTitle(val);
            clearError('title');
          }}
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('listing.description')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={
            translation.activeLang === 'sq'
              ? t('listing.descriptionPlaceholder')
              : `${t('listing.description')} (${translation.activeLang.toUpperCase()})`
          }
          placeholderTextColor={colors.textSecondary}
          value={translation.description}
          onChangeText={(val) => {
            translation.editDescription(val);
            clearError('description');
          }}
          multiline
          textAlignVertical="top"
        />
        {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
      </View>
    </>
  );

  const renderLocation = () => (
    <>
      <Labeled styles={styles} label={t('listing.city')} error={errors.city}>
        <SelectField
          value={form.city}
          options={CITIES.map((c) => ({ value: c, label: c }))}
          placeholder={t('listing.city')}
          icon="location-city"
          onChange={(v) => {
            update('city', v);
            clearError('city');
          }}
        />
      </Labeled>

      <Labeled styles={styles} label={t('listing.address')}>
        <Field
          icon="place"
          placeholder={t('listing.addressPlaceholder')}
          value={form.address}
          onChangeText={(val) => update('address', val)}
        />
      </Labeled>

      <View style={styles.fieldBlock}>
        <SectionLabel label={t('listing.pinLocation')} />
        {/* Without a pin the listing is invisible on the map tab — map queries
            exclude rows with null coordinates. */}
        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
        />
        <Text style={styles.hint}>
          {form.latitude != null && form.longitude != null
            ? `${form.latitude}, ${form.longitude}`
            : t('listing.mapHint')}
        </Text>
      </View>
    </>
  );

  const renderDetails = () => (
    <>
      <View style={styles.row}>
        <Labeled styles={styles} label={t('listing.price')} error={errors.price} style={styles.flex2}>
          <Field
            icon="euro"
            placeholder="0"
            keyboardType="numeric"
            value={form.price}
            onChangeText={(val) => {
              update('price', val);
              clearError('price');
            }}
          />
        </Labeled>
        <Labeled styles={styles} label={t('listing.currency')} style={styles.flex1}>
          <SelectField
            value={form.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            placeholder={t('listing.currency')}
            icon="payments"
            onChange={(v) => update('currency', v as Currency)}
          />
        </Labeled>
      </View>

      <Labeled styles={styles} label={`${t('listing.surface')} (m²)`} error={errors.sqft}>
        <Field
          icon="straighten"
          placeholder="0"
          keyboardType="numeric"
          value={form.sqft}
          onChangeText={(val) => {
            update('sqft', val);
            clearError('sqft');
          }}
        />
      </Labeled>

      <View style={styles.row}>
        <Labeled styles={styles} label={t('property.beds')} error={errors.beds} style={styles.flex1}>
          <Field
            icon="king-bed"
            placeholder="0"
            keyboardType="numeric"
            value={form.beds}
            onChangeText={(val) => {
              update('beds', val);
              clearError('beds');
            }}
          />
        </Labeled>
        <Labeled styles={styles} label={t('property.baths')} error={errors.baths} style={styles.flex1}>
          <Field
            icon="bathtub"
            placeholder="0"
            keyboardType="numeric"
            value={form.baths}
            onChangeText={(val) => {
              update('baths', val);
              clearError('baths');
            }}
          />
        </Labeled>
      </View>

      <View style={styles.row}>
        <Labeled styles={styles} label={t('listing.floor')} error={errors.floor} style={styles.flex1}>
          <Field
            icon="stairs"
            placeholder="0"
            keyboardType="numeric"
            value={form.floor}
            onChangeText={(val) => {
              update('floor', val);
              clearError('floor');
            }}
          />
        </Labeled>
        <Labeled styles={styles} label={t('listing.totalFloors')} error={errors.total_floors} style={styles.flex1}>
          <Field
            icon="layers"
            placeholder="0"
            keyboardType="numeric"
            value={form.total_floors}
            onChangeText={(val) => {
              update('total_floors', val);
              clearError('total_floors');
            }}
          />
        </Labeled>
      </View>

      <Labeled styles={styles} label={t('listing.yearBuilt')} error={errors.year_built}>
        <Field
          icon="event"
          placeholder="2024"
          keyboardType="numeric"
          value={form.year_built}
          onChangeText={(val) => {
            update('year_built', val);
            clearError('year_built');
          }}
        />
      </Labeled>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('listing.features')}</Text>
        <View style={styles.chipRow}>
          {FEATURES_LIST.map((f) => (
            <Chip
              key={f}
              label={t(`listing.feature.${f}`, f)}
              on={form.features.includes(f)}
              onPress={() => toggleFeature(f)}
              withDot
            />
          ))}
        </View>
      </View>
    </>
  );

  const renderMedia = () => (
    <>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>
          {t('listing.images')} ({images.length}/{MAX_IMAGES})
        </Text>
        <View style={styles.photoGrid}>
          {images.map((img, index) => (
            <View key={img.uri} style={styles.photoThumb}>
              <Image source={{ uri: img.uri }} style={styles.photoThumbImage} contentFit="cover" />
              <Pressable
                style={styles.photoRemove}
                onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}>
                <MaterialIcons name="close" size={13} color="#fff" />
              </Pressable>
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>{t('listing.cover')}</Text>
                </View>
              )}
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <Pressable
              style={styles.photoAdd}
              onPress={handlePickImages}
              accessibilityRole="button"
              accessibilityLabel={t('listing.dropImages')}>
              <MaterialIcons name="add-a-photo" size={22} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <Text style={styles.hint}>{t('listing.minImages')}</Text>
        {errors.images ? <Text style={styles.errorText}>{errors.images}</Text> : null}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('listing.videoUpload')}</Text>
        {video ? (
          <View style={styles.videoRow}>
            <MaterialIcons name="movie" size={18} color={colors.accent} />
            <View style={styles.videoMeta}>
              <Text style={styles.videoName} numberOfLines={1}>
                {video.fileName}
              </Text>
              <Text style={styles.hint}>{(video.size / (1024 * 1024)).toFixed(1)} MB</Text>
            </View>
            <Pressable
              onPress={() => setVideo(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <MaterialIcons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.videoDrop}
            onPress={handlePickVideo}
            accessibilityRole="button"
            accessibilityLabel={t('listing.dropVideo')}>
            <MaterialIcons name="movie" size={22} color={colors.accent} />
            <Text style={styles.hint}>{t('listing.dropVideo')}</Text>
          </Pressable>
        )}
        {errors.video ? <Text style={styles.errorText}>{errors.video}</Text> : null}
      </View>

      {uploadProgress && (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.hint}>
            {t('common.loading')} ({uploadProgress.done}/{uploadProgress.total})
          </Text>
        </View>
      )}
    </>
  );

  const renderPublish = () => (
    <>
      <View style={styles.fieldBlock}>
        <SectionLabel label={t('listing.contactInfo')} />
      </View>

      <Labeled styles={styles} label={t('listing.phone')} error={errors.phone}>
        <Field
          icon="phone"
          placeholder="+355 69..."
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          value={form.contact_phone}
          onChangeText={(val) => {
            update('contact_phone', val);
            clearError('phone');
          }}
        />
      </Labeled>

      <Pressable
        style={styles.checkRow}
        onPress={() => update('whatsapp_enabled', !form.whatsapp_enabled)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.whatsapp_enabled }}>
        <MaterialIcons
          name={form.whatsapp_enabled ? 'check-box' : 'check-box-outline-blank'}
          size={20}
          color={form.whatsapp_enabled ? colors.accent : colors.textSecondary}
        />
        <Text style={styles.checkLabel}>WhatsApp</Text>
      </Pressable>

      <Labeled styles={styles} label={t('listing.email')}>
        <Field
          icon="mail"
          placeholder="john.doe@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          value={form.contact_email}
          onChangeText={(val) => update('contact_email', val)}
        />
      </Labeled>

      {/* Summary of what's about to go live, so the last step isn't just two
          more inputs — the same "review before publish" beat web gets from
          having the whole form still visible above the fold. */}
      <View style={styles.summary}>
        <SummaryRow
          styles={styles}
          label={t('listing.title')}
          value={form.title_i18n.sq || '—'}
        />
        <SummaryRow
          styles={styles}
          label={t('listing.city')}
          value={[form.city, form.address].filter(Boolean).join(' · ') || '—'}
        />
        <SummaryRow
          styles={styles}
          label={t('listing.price')}
          value={form.price ? `${Number(form.price).toLocaleString()} ${form.currency}` : '—'}
        />
        <SummaryRow
          styles={styles}
          label={t('listing.images')}
          value={`${images.length}${video ? ' + 1 video' : ''}`}
        />
      </View>

      {errors.submit ? <Text style={styles.errorText}>{errors.submit}</Text> : null}

      {uploadProgress && (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.hint}>
            {t('common.loading')} ({uploadProgress.done}/{uploadProgress.total})
          </Text>
        </View>
      )}
    </>
  );

  const stepBody = [renderBasics, renderLocation, renderDetails, renderMedia, renderPublish][step];
  const isLast = step === STEPS.length - 1;

  if (!hydrated) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header — mono step counter left, serif step name right (web's
            .nl-step-counter / .nl-step-name). */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => (step > 0 ? prev() : router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}>
            <MaterialIcons name="chevron-left" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.stepCounter}>
            {`${t('listing.step.' + STEPS[step])} ${step + 1}/${STEPS.length}`.toUpperCase()}
          </Text>
          <Text style={styles.stepName} numberOfLines={1}>
            {t('listing.newListing')}
          </Text>
        </View>

        {/* Stepper — completed steps get a check in a gradient dot, the current
            one a scaled gradient dot with a tint ring, and each connector
            fills as it's passed. */}
        <View style={styles.stepper} accessibilityRole="progressbar">
          {STEPS.map((s, i) => {
            const completed = i < step;
            const current = i === step;
            return (
              <View key={s} style={styles.stepItem}>
                <Pressable
                  // Jumping back to a completed step is safe (its data is
                  // already validated); jumping forward would skip the gates
                  // in between, so only i < step is reachable.
                  disabled={!completed}
                  onPress={() => setStep(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  style={styles.stepPress}>
                  {/* Web's current dot gets `box-shadow: 0 0 0 4px tint`, a
                      ring *outside* the circle. RN has no shadow spread, so
                      the ring is a tinted wrapper the dot sits inside. */}
                  <View style={[styles.stepRing, current && styles.stepRingOn]}>
                    <View style={[styles.stepDot, current && styles.stepDotCurrent]}>
                      {(completed || current) && (
                        <LinearGradient
                          colors={[colors.accent, colors.accentEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[StyleSheet.absoluteFillObject, styles.stepDotFill]}
                        />
                      )}
                      {completed ? (
                        <MaterialIcons name="check" size={13} color="#fff" />
                      ) : (
                        <Text style={[styles.stepDotText, current && styles.stepDotTextOn]}>
                          {i + 1}
                        </Text>
                      )}
                    </View>
                  </View>
                  {current && <Text style={styles.stepLabel}>{t(`listing.step.${s}`)}</Text>}
                </Pressable>
                {i < STEPS.length - 1 && (
                  <View style={styles.stepLine}>
                    {completed && (
                      <LinearGradient
                        colors={[colors.accent, colors.accentEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {draftRestored && (
          <View style={styles.draftBanner}>
            <MaterialIcons name="history" size={16} color={colors.accent} />
            <Text style={styles.draftText}>{t('listing.draftRestored')}</Text>
            <Pressable onPress={discardDraft} hitSlop={8} accessibilityRole="button">
              <Text style={styles.draftAction}>{t('listing.discardDraft')}</Text>
            </Pressable>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Keyed on the step so each one animates in rather than swapping
                content underneath a static frame. */}
            <RiseIn key={step}>{stepBody()}</RiseIn>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          {isLast && (
            <Pressable
              onPress={() => submit('draft')}
              disabled={submitting}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.draftLinkWrap}>
              <Text style={styles.draftLink}>{t('listing.saveDraft')}</Text>
            </Pressable>
          )}
          <View style={styles.footerRow}>
            {step > 0 && (
              <GhostBtn label={t('listing.back')} icon="arrow-back" onPress={prev} />
            )}
            <PrimaryCTA
              style={styles.flex1}
              label={
                submitting
                  ? t('common.loading')
                  : isLast
                    ? t('listing.publish')
                    : t('listing.next')
              }
              icon={isLast ? 'check' : 'arrow-forward'}
              loading={submitting}
              disabled={submitting}
              onPress={() => (isLast ? submit('active') : next())}
            />
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

/**
 * These live at module scope on purpose. Declared inside the wizard they would
 * get a fresh function identity on every keystroke, React would treat each
 * render as a different component type, and the TextInput underneath would
 * remount and drop focus mid-typing.
 */
function Labeled({
  styles,
  label,
  error,
  children,
  style,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  error?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fieldBlock, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex1: { flex: 1 },
    flex2: { flex: 2 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glass,
    },
    stepCounter: {
      fontFamily: Fonts?.mono,
      fontSize: 11,
      letterSpacing: 1.1,
      color: colors.textSecondary,
    },
    stepName: {
      marginLeft: 'auto',
      fontFamily: Fonts?.serif,
      fontSize: 20,
      color: colors.textPrimary,
      flexShrink: 1,
    },

    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    stepItem: { flexDirection: 'row', alignItems: 'center' },
    stepPress: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepDotFill: { borderRadius: 13 },
    stepDotCurrent: {
      borderColor: 'transparent',
      transform: [{ scale: 1.15 }],
    },
    stepRing: { borderRadius: 17, padding: 4 },
    stepRingOn: { backgroundColor: colors.accentTint },
    stepDotText: {
      fontFamily: Fonts?.monoMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    stepDotTextOn: { color: '#fff' },
    stepLabel: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 12,
      color: colors.textPrimary,
    },
    stepLine: {
      width: 18,
      height: 2,
      marginHorizontal: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },

    draftBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentTint,
    },
    draftText: { flex: 1, fontFamily: Fonts?.sans, fontSize: 12, color: colors.textPrimary },
    draftAction: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 12,
      color: colors.accentEnd,
    },

    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },

    fieldBlock: { gap: 8 },
    row: { flexDirection: 'row', gap: 12 },
    fieldLabel: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    hint: { fontFamily: Fonts?.sans, fontSize: 12, color: colors.textSecondary },
    errorText: { fontFamily: Fonts?.sans, fontSize: 12, color: colors.error },

    radioGroup: { flexDirection: 'row', gap: 8 },
    radioWrap: { flex: 1 },
    radio: {
      paddingVertical: 12,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      overflow: 'hidden',
    },
    radioActive: { borderColor: 'transparent' },
    radioText: { fontFamily: Fonts?.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    radioTextActive: { color: '#fff' },

    langTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    langTab: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    langTabActive: { backgroundColor: colors.accentEnd, borderColor: 'transparent' },
    langTabFilled: { borderColor: colors.accentLight },
    langTabText: { fontFamily: Fonts?.mono, fontSize: 11, color: colors.textSecondary },
    langTabTextActive: { color: '#fff' },

    input: {
      backgroundColor: colors.surface2,
      borderRadius: Radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: Fonts?.sans,
      fontSize: 14,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: { height: 120, paddingTop: 12 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoThumb: {
      width: 84,
      height: 84,
      borderRadius: Radii.md,
      overflow: 'hidden',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoThumbImage: { width: '100%', height: '100%' },
    photoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    coverBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.accentEnd,
    },
    coverBadgeText: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      color: '#fff',
      letterSpacing: 0.4,
    },
    photoAdd: {
      width: 84,
      height: 84,
      borderRadius: Radii.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    videoDrop: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 20,
      borderRadius: Radii.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    videoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    videoMeta: { flex: 1, minWidth: 0 },
    videoName: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 13,
      color: colors.textPrimary,
    },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkLabel: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },

    summary: {
      gap: 8,
      padding: 14,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryLabel: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.textSecondary,
      width: 92,
    },
    summaryValue: {
      flex: 1,
      textAlign: 'right',
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 13,
      color: colors.textPrimary,
    },

    footer: {
      gap: 10,
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 20 : 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.primary,
    },
    footerRow: { flexDirection: 'row', gap: 10 },
    draftLinkWrap: { alignSelf: 'center' },
    draftLink: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 13,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
  });
