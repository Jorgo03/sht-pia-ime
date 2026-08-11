import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { ActionButton } from '@/components/ui/action-button';
import { AiTitleButton } from '@/components/ui/ai-title-button';
import { AutoTranslateButton } from '@/components/ui/auto-translate-button';
import { GradientBackground } from '@/components/ui/gradient-background';
import { AtticoColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { SUPPORTED_LANGS, type I18nMap } from '@/lib/translate';

type ListingType = 'sale' | 'rent';
type PropertyType = 'apartment' | 'house' | 'land' | 'commercial';
type Status = 'active' | 'draft';

const PROPERTY_TYPES: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'apartment', label: 'Apartment', icon: 'apartment' },
  { value: 'house', label: 'House', icon: 'home' },
  { value: 'land', label: 'Land', icon: 'landscape' },
  { value: 'commercial', label: 'Commercial', icon: 'store' },
];

interface ListingForm {
  listing_type: ListingType;
  property_type: PropertyType;
  title_i18n: I18nMap;
  description_i18n: I18nMap;
  address: string;
  city: string;
  /** Null until the agent taps the map; excluded from the map tab if unset. */
  latitude: number | null;
  longitude: number | null;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  status: Status;
}

const INITIAL_FORM: ListingForm = {
  listing_type: 'sale',
  property_type: 'apartment',
  title_i18n: { sq: '' },
  description_i18n: { sq: '' },
  address: '',
  city: '',
  latitude: null,
  longitude: null,
  price: '',
  beds: '',
  baths: '',
  sqft: '',
  status: 'active',
};

export default function CreateListingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [titleLang, setTitleLang] = useState('sq');
  const [descLang, setDescLang] = useState('sq');
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateI18n = (field: 'title_i18n' | 'description_i18n', lang: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: { ...prev[field], [lang]: value },
    }));

  const handleTranslateResult = (field: 'title_i18n' | 'description_i18n', result: I18nMap) =>
    setForm((prev) => ({
      ...prev,
      [field]: { ...prev[field], ...result },
    }));

  const handleSubmit = async (status: Status) => {
    if (!form.title_i18n.sq?.trim()) {
      Alert.alert(t('listing.required'), t('listing.title'));
      return;
    }
    if (!form.price?.trim()) {
      Alert.alert(t('listing.required'), t('listing.price'));
      return;
    }
    if (!form.address?.trim()) {
      Alert.alert(t('listing.required'), t('listing.address'));
      return;
    }
    if (!user) {
      Alert.alert(t('common.error'), t('errors.authFailed'));
      return;
    }

    setSubmitting(true);
    try {
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
        address: form.address,
        city: form.city || null,
        latitude: form.latitude,
        longitude: form.longitude,
        // This form authors in Albanian and translates outward from it, so sq
        // is the human-written version; every other i18n key is a translation.
        source_language: 'sq',
        beds: form.beds ? Number(form.beds) : null,
        baths: form.baths ? Number(form.baths) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        property_type: form.property_type,
        listing_type: form.listing_type,
        image_urls: [],
        status,
      });

      if (error) throw error;

      Alert.alert(
        'OK',
        status === 'draft' ? t('listing.saveDraft') : t('listing.publish'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message ?? t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderLangTabs = (
    activeLang: string,
    onSelect: (lang: string) => void,
    i18nMap: I18nMap,
  ) => (
    <View style={styles.langTabs}>
      {SUPPORTED_LANGS.map((lang) => {
        const hasContent = !!i18nMap[lang]?.trim();
        return (
          <TouchableOpacity
            key={lang}
            style={[
              styles.langTab,
              activeLang === lang && styles.langTabActive,
              hasContent && activeLang !== lang && styles.langTabFilled,
            ]}
            onPress={() => onSelect(lang)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.langTabText,
                activeLang === lang && styles.langTabTextActive,
              ]}>
              {lang.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
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
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="sell" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('listing.listingType')}</Text>
              </View>
              <View style={styles.toggleRow}>
                {(['sale', 'rent'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.toggleTab, form.listing_type === type && styles.toggleTabActive]}
                    onPress={() => updateField('listing_type', type)}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name={type === 'sale' ? 'paid' : 'vpn-key'}
                      size={18}
                      color={form.listing_type === type ? '#fff' : AtticoColors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.toggleTabText,
                        form.listing_type === type && styles.toggleTabTextActive,
                      ]}>
                      {type === 'sale' ? t('detail.forSale') : t('detail.forRent')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Property Type */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="home-work" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('search.propertyType')}</Text>
              </View>
              <View style={styles.chipRow}>
                {PROPERTY_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt.value}
                    style={[styles.chip, form.property_type === pt.value && styles.chipActive]}
                    onPress={() => updateField('property_type', pt.value)}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name={pt.icon as any}
                      size={16}
                      color={form.property_type === pt.value ? '#fff' : AtticoColors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        form.property_type === pt.value && styles.chipTextActive,
                      ]}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title i18n */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="title" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('listing.title')}</Text>
              </View>
              {renderLangTabs(titleLang, setTitleLang, form.title_i18n)}
              <TextInput
                style={styles.input}
                placeholder={titleLang === 'sq' ? t('listing.titlePlaceholder') : `${t('listing.title')} (${titleLang.toUpperCase()})`}
                placeholderTextColor={AtticoColors.textSecondary}
                value={form.title_i18n[titleLang] ?? ''}
                onChangeText={(val) => updateI18n('title_i18n', titleLang, val)}
              />
              <View style={styles.titleActions}>
                {/* Grounded on whatever the form already holds; writes only
                    the title, leaving any description the agent typed alone. */}
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
                    setTitleLang('sq');
                  }}
                />
                <AutoTranslateButton
                  sourceText={form.title_i18n.sq ?? ''}
                  fieldLabel="Title"
                  onResult={(r) => handleTranslateResult('title_i18n', r)}
                />
              </View>
            </View>

            {/* Description i18n */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="description" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('listing.description')}</Text>
              </View>
              {renderLangTabs(descLang, setDescLang, form.description_i18n)}
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={descLang === 'sq' ? t('listing.descriptionPlaceholder') : `${t('listing.description')} (${descLang.toUpperCase()})`}
                placeholderTextColor={AtticoColors.textSecondary}
                value={form.description_i18n[descLang] ?? ''}
                onChangeText={(val) => updateI18n('description_i18n', descLang, val)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <AutoTranslateButton
                sourceText={form.description_i18n.sq ?? ''}
                fieldLabel="Description"
                onResult={(r) => handleTranslateResult('description_i18n', r)}
              />
            </View>

            {/* Location */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="location-on" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('listing.address')}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('listing.addressPlaceholder')}
                placeholderTextColor={AtticoColors.textSecondary}
                value={form.address}
                onChangeText={(val) => updateField('address', val)}
              />
              <TextInput
                style={styles.input}
                placeholder={t('listing.city')}
                placeholderTextColor={AtticoColors.textSecondary}
                value={form.city}
                onChangeText={(val) => updateField('city', val)}
              />
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

            {/* Details */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="info-outline" size={20} color={AtticoColors.accent} />
                <Text style={styles.sectionTitle}>{t('listing.price')}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder={form.listing_type === 'rent' ? `${t('listing.price')} (${t('property.perMonth')})` : t('listing.price')}
                placeholderTextColor={AtticoColors.textSecondary}
                value={form.price}
                onChangeText={(val) => updateField('price', val)}
                keyboardType="numeric"
              />
              <View style={styles.detailRow}>
                <TextInput
                  style={[styles.input, styles.detailInput]}
                  placeholder={t('property.beds')}
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={form.beds}
                  onChangeText={(val) => updateField('beds', val)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.detailInput]}
                  placeholder={t('property.baths')}
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={form.baths}
                  onChangeText={(val) => updateField('baths', val)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.detailInput]}
                  placeholder={t('property.sqft')}
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={form.sqft}
                  onChangeText={(val) => updateField('sqft', val)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Submit */}
            <View style={styles.submitSection}>
              <ActionButton
                title={submitting ? t('common.loading') : t('listing.publish')}
                onPress={() => handleSubmit('active')}
              />
              <ActionButton
                title={t('listing.saveDraft')}
                variant="secondary"
                onPress={() => handleSubmit('draft')}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
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
    fontSize: 18,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },

  // Sections
  // Wraps so the two title actions stack on narrow screens instead of
  // squeezing each other.
  titleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
  },
  section: {
    backgroundColor: AtticoColors.primaryLight,
    borderRadius: 20,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
  },

  // Toggle tabs (sale/rent)
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: AtticoColors.primary,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  toggleTabActive: {
    backgroundColor: AtticoColors.accent,
  },
  toggleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
  },
  toggleTabTextActive: {
    color: '#fff',
  },

  // Property type chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
  },
  chipActive: {
    backgroundColor: AtticoColors.accent,
    borderColor: AtticoColors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },

  // Language tabs
  langTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  langTab: {
    width: 38,
    height: 32,
    borderRadius: 8,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langTabActive: {
    backgroundColor: AtticoColors.accent,
    borderColor: AtticoColors.accent,
  },
  langTabFilled: {
    borderColor: AtticoColors.accentLight,
  },
  langTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: AtticoColors.textSecondary,
  },
  langTabTextActive: {
    color: '#fff',
  },

  // Inputs
  input: {
    backgroundColor: AtticoColors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: AtticoColors.textPrimary,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },

  // Detail row (beds/baths/sqft)
  detailRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailInput: {
    flex: 1,
  },

  // Submit
  submitSection: {
    gap: 12,
    marginTop: 8,
  },
});
