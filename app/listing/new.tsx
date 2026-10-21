import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { RoadField } from '@/components/listing/road-field';
import { TranslationBar } from '@/components/listing/translation-bar';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { Chip, SectionLabel } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { GradientBackground } from '@/components/ui/gradient-background';
import { RiseIn } from '@/components/ui/motion';
import { SelectField } from '@/components/ui/select-field';
import { KEYBOARD_DONE_ID, KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { translatePropertyContent, type I18nMap } from '@/lib/translate';
import { geocodeCity, type RoadSuggestion } from '@/src/lib/roadSearch';
import { useListingTranslation } from '@/src/features/listings/hooks/useListingTranslation';
import { formToColumns, propertyToForm, removedMediaPaths } from '@/src/features/listings/lib/listingForm';
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
import { zonesFor } from '@/src/features/properties/lib/searchFilters';

/**
 * Multi-step listing wizard — the native counterpart to web's
 * src/features/listings/pages/NewListing.jsx.
 *
 * Same five steps, same per-step validation, same insert payload and same
 * draft-restore behaviour, so a listing is identical whichever app created it.
 * It is the only listing form: the old single-scroll `listing/create.tsx` now
 * redirects here.
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
  // 'heating' is no longer offered (owner's call, 2026-10-15). Listings that
  // already have it still show it: listing.feature.heating stays in the locales.
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

/**
 * Photos and video in the wizard. When editing, the ones already in storage
 * join the same lists flagged `existing` (their `uri` is the public URL), so
 * ordering, the cover photo and removal work exactly as when creating.
 */
type WizardImage = PickedImage & { existing?: boolean };
type WizardVideo = PickedVideo & { existing?: boolean };

type EditState = 'loading' | 'ready' | 'error' | 'forbidden';

type LoadedListing =
  | { state: 'ready'; row: Record<string, any> }
  | { state: 'error' | 'forbidden' };

/** The listing to edit, if this user may edit it. */
async function fetchEditableListing(id: string, userId: string): Promise<LoadedListing> {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();
  if (error) return { state: 'error' };
  // RLS already hides other people's drafts; this also covers active listings
  // someone else owns, which everyone can read but only the owner may edit.
  if (!data || (data.owner_id !== userId && data.agent_id !== userId)) return { state: 'forbidden' };
  return { state: 'ready', row: data };
}

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
  /** Neighbourhood from the city's zone list; '' when not chosen. */
  zone: string;
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
  zone: '',
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

/** /listing/new: a blank wizard, with draft restore. */
export default function NewListingWizard() {
  return <ListingWizard />;
}

/** /listing/[id]/edit: the same wizard opened on a saved listing. */
export function EditListingWizard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingWizard editId={id} />;
}

function ListingWizard({ editId }: { editId?: string }) {
  const isEdit = Boolean(editId);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [images, setImages] = useState<WizardImage[]>([]);
  const [video, setVideo] = useState<WizardVideo | null>(null);
  const [editState, setEditState] = useState<EditState>(isEdit ? 'loading' : 'ready');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // First paint waits on the draft read so a restore can never land on top of
  // something the agent already typed. It's one AsyncStorage get.
  // Editing has no draft to read, so it is hydrated from the start.
  const [hydrated, setHydrated] = useState(isEdit);

  // Load the listing being edited. Editing never reads or writes the
  // new-listing draft, so an unfinished draft survives an edit untouched.
  // Media the listing had when it was opened for editing; anything missing
  // after a successful save is deleted from storage.
  const originalMedia = useRef<string[]>([]);

  const applyLoaded = useCallback((result: LoadedListing) => {
    if (result.state !== 'ready') {
      setEditState(result.state);
      return;
    }
    const { row } = result;
    setForm({ ...INITIAL_FORM, ...(propertyToForm(row) as Partial<ListingForm>) });
    setImages(
      ((row.image_urls ?? []) as string[]).map((url) => ({
        uri: url,
        fileName: url.split('/').pop() ?? 'photo.jpg',
        mimeType: 'image/jpeg',
        existing: true,
      })),
    );
    setVideo(
      row.video_url
        ? { uri: row.video_url, fileName: '', mimeType: 'video/mp4', size: 0, existing: true }
        : null,
    );
    originalMedia.current = [...((row.image_urls ?? []) as string[]), row.video_url].filter(Boolean);
    setEditState('ready');
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!editId || !userId) return;
    let cancelled = false;
    void fetchEditableListing(editId, userId).then((result) => {
      if (!cancelled) applyLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [editId, userId, applyLoaded]);

  const retryLoad = () => {
    if (!editId || !userId) return;
    setEditState('loading');
    void fetchEditableListing(editId, userId).then(applyLoaded);
  };

  useEffect(() => {
    if (isEdit) return;
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
  }, [isEdit]);

  // Persist progress on every change. Photos and video hold local file URIs
  // that don't survive a restart, so — exactly like web — only the form and
  // the step are saved and media is re-added after a restore.
  useEffect(() => {
    if (!hydrated || isEdit) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, savedAt: Date.now() })).catch(
      () => {
        /* storage full/blocked — the wizard still works, just unsaved */
      },
    );
  }, [form, step, hydrated, isEdit]);

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

  /**
   * Where the map should look: the selected road, or the city centre.
   *
   * Kept out of `form` on purpose — it is view state, never persisted, and
   * must not be mistaken for the property's coordinates.
   */
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);

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
      if (images.length < MIN_IMAGES) errs.images = t('listing.minImages', { min: MIN_IMAGES });
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
      // Only photos added in this session are uploaded; ones already in
      // storage (editing) keep their URL and their place in the order.
      const fresh = images.filter((img) => !img.existing);
      let freshUrls: string[] = [];
      if (fresh.length > 0) {
        setUploadProgress({ done: 0, total: fresh.length });
        const { urls, paths } = await uploadPropertyImages(fresh, user.id, (done, total) =>
          setUploadProgress({ done, total }),
        );
        freshUrls = urls;
        uploadedPaths = paths;
      }
      let nextFresh = 0;
      const imageUrls = images.map((img) => (img.existing ? img.uri : freshUrls[nextFresh++]));

      // Video rides the same all-or-nothing rule as the photos.
      let videoUrl: string | null = video?.existing ? video.uri : null;
      if (video && !video.existing) {
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

      // Fill every language the agent did not open a tab for. Without this a
      // listing reaches the site with only the languages they happened to
      // click, and card surfaces — which resolve titles synchronously and
      // never fetch — show the fallback language to every visitor regardless
      // of what they select. Returns the maps it produced, because setForm has
      // not landed by the time this save runs.
      const translated = await translation.translateAll();

      // Same columns as web, from the shared helper, for insert and update.
      const columns = {
        ...formToColumns(form, translated),
        image_urls: imageUrls,
        video_url: videoUrl,
      };

      let error;
      if (isEdit) {
        // Ownership and status are never part of an edit: status has its own
        // actions on My Listings (pause, mark sold/rented).
        ({ error } = await supabase.from('properties').update(columns).eq('id', editId!));
      } else {
        // Only an agent's own listing carries an agent_id — a client-posted
        // one must not claim agent attribution (same rule as web).
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        const isAgent = profile?.role === 'agent';
        ({ error } = await supabase.from('properties').insert({
          ...columns,
          // RLS requires owner_id = auth.uid() on insert.
          owner_id: user.id,
          agent_id: isAgent ? user.id : null,
          owner_type: isAgent ? 'agent' : 'client',
          status,
        }));
      }

      // Insert failed after upload succeeded — don't leave orphaned files.
      if (error) {
        await removeUploadedImages(uploadedPaths);
        throw error;
      }

      if (!isEdit) await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      if (isEdit) {
        // The save went through, so photos/video taken out of the listing are
        // no longer referenced anywhere: remove them (own folder only).
        await removeUploadedImages(
          removedMediaPaths({ before: originalMedia.current, after: [...imageUrls, videoUrl], userId: user.id }),
        );
      }
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
                      style={StyleSheet.absoluteFill}
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
          provider={translation.provider}
          onRegenerate={translation.regenerate}
          onRetry={translation.retry}
          canRegenerate={translation.canRegenerate}
        />

        <TextInput
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          style={styles.input}
          // On a non-source language with nothing translated yet, the Albanian
          // itself is the most useful placeholder — it shows what is about to
          // be translated instead of leaving a blank box.
          placeholder={
            translation.activeLang === 'sq'
              ? t('listing.titlePlaceholder')
              : translation.sourceTitle ||
                `${t('listing.title')} (${translation.activeLang.toUpperCase()})`
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
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          style={[styles.input, styles.textArea]}
          placeholder={
            translation.activeLang === 'sq'
              ? t('listing.descriptionPlaceholder')
              : translation.sourceDescription ||
                `${t('listing.description')} (${translation.activeLang.toUpperCase()})`
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
            if (v === form.city) return;
            // A new city invalidates everything downstream of it. Leaving the
            // old road would keep a street that does not exist here, and
            // leaving the pin would publish a property in the previous city —
            // the kind of stale coordinate nobody notices until it is on a map.
            setForm((prev) => ({
              ...prev,
              city: v,
              zone: '',
              address: '',
              latitude: null,
              longitude: null,
            }));
            clearError('city');
            setMapFocus(null);
            // Move the map to the new city so the next pin starts from
            // somewhere plausible rather than from wherever it was left.
            void geocodeCity({ city: v }).then((centre) => {
              if (centre) setMapFocus(centre);
            });
          }}
        />
      </Labeled>

      {zonesFor(form.city).length > 0 ? (
        <Labeled styles={styles} label={t('listing.zone')}>
          <SelectField
            value={form.zone}
            options={[
              { value: '', label: t('listing.zoneNone') },
              ...zonesFor(form.city).map((z) => ({ value: z, label: z })),
            ]}
            placeholder={t('listing.zoneNone')}
            icon="place"
            onChange={(v) => update('zone', v)}
          />
        </Labeled>
      ) : null}

      <Labeled styles={styles} label={t('listing.address')}>
        <RoadField
          city={form.city}
          value={form.address}
          placeholder={t('listing.addressPlaceholder')}
          onChangeText={(val) => update('address', val)}
          // Picking a road frames the map; it never sets the property's
          // position. That still comes from the marker.
          onSelectRoad={(road: RoadSuggestion) =>
            setMapFocus({ latitude: road.latitude, longitude: road.longitude })
          }
        />
      </Labeled>

      <View style={styles.fieldBlock}>
        <SectionLabel label={t('listing.pinLocation')} />
        {/* Without a pin the listing is invisible on the map tab — map queries
            exclude rows with null coordinates. */}
        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          focus={mapFocus}
          onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
        />
      </View>
    </>
  );

  const renderDetails = () => (
    <>
      <View style={styles.row}>
        <Labeled styles={styles} label={t('listing.price')} error={errors.price} style={styles.flex2}>
          <Field
            inputAccessoryViewID={KEYBOARD_DONE_ID}
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
          inputAccessoryViewID={KEYBOARD_DONE_ID}
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
            inputAccessoryViewID={KEYBOARD_DONE_ID}
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
            inputAccessoryViewID={KEYBOARD_DONE_ID}
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
            inputAccessoryViewID={KEYBOARD_DONE_ID}
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
            inputAccessoryViewID={KEYBOARD_DONE_ID}
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
          inputAccessoryViewID={KEYBOARD_DONE_ID}
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
              <Image accessibilityLabel={t('listing.images')} source={{ uri: img.uri }} style={styles.photoThumbImage} contentFit="cover" />
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
        <Text style={styles.hint}>{t('listing.minImages', { min: MIN_IMAGES })}</Text>
        {errors.images ? <Text style={styles.errorText}>{errors.images}</Text> : null}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('listing.videoUpload')}</Text>
        {video ? (
          <View style={styles.videoRow}>
            <MaterialIcons name="movie" size={18} color={colors.accent} />
            <View style={styles.videoMeta}>
              <Text style={styles.videoName} numberOfLines={1}>
                {video.existing ? t('listing.currentVideo') : video.fileName}
              </Text>
              {!video.existing && (
                <Text style={styles.hint}>{(video.size / (1024 * 1024)).toFixed(1)} MB</Text>
              )}
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
          inputAccessoryViewID={KEYBOARD_DONE_ID}
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
          inputAccessoryViewID={KEYBOARD_DONE_ID}
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

  if (!hydrated || editState === 'loading') {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (editState === 'error' || editState === 'forbidden') {
    return (
      <GradientBackground>
        <SafeAreaView style={[styles.centered, styles.editMessage]}>
          <Text style={styles.editMessageText}>
            {editState === 'error' ? t('errors.generic') : t('detail.unavailable')}
          </Text>
          {editState === 'error' ? (
            <PrimaryCTA label={t('common.retry')} icon="refresh" onPress={retryLoad} />
          ) : (
            <GhostBtn
              label={t('listing.myListings')}
              icon="arrow-back"
              onPress={() => router.replace('/my-listings')}
            />
          )}
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
          <Text style={styles.stepName} numberOfLines={1} accessibilityRole="header">
            {isEdit ? t('listing.editListing') : t('listing.newListing')}
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
                          style={[StyleSheet.absoluteFill, styles.stepDotFill]}
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
                        style={StyleSheet.absoluteFill}
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
            // Dragging the form down closes the keyboard, on both platforms.
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled">
            {/* Keyed on the step so each one animates in rather than swapping
                content underneath a static frame. */}
            <RiseIn key={step} style={styles.stepBody}>{stepBody()}</RiseIn>
          </ScrollView>
          <KeyboardDoneBar />
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          {isLast && !isEdit && (
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
                    ? isEdit
                      ? t('listing.saveChanges')
                      : t('listing.publish')
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
    editMessage: { gap: Spacing.lg, paddingHorizontal: Spacing.xl },
    editMessageText: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 16,
      color: colors.textPrimary,
      textAlign: 'center',
    },
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
      color: colors.accentText,
    },

    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },

    // Space between fields. It has to live here: the scroll view's own gap
    // only separates its direct children, and the whole step is one RiseIn,
    // so without this every label sat flush against the box above it.
    stepBody: { gap: Spacing.lg },
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
