import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/ui/select-field';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { Property, PropertySort } from '@/data/types';
import { usePropertiesCountQuery } from '@/hooks/use-property-queries';
// Shared with the web app rather than duplicated — the same convention i18n
// already uses to pull locales out of src/.
import LOCATIONS from '@/src/features/properties/data/locations';

type PropertyType = NonNullable<Property['property_type']>;
type ListingType = NonNullable<Property['listing_type']>;

const PROPERTY_TYPES: PropertyType[] = [
  'apartment',
  'villa',
  'house',
  'land',
  'office',
];
const LISTING_TYPES: ListingType[] = ['sale', 'rent'];
const COUNT_OPTIONS = [1, 2, 3, 4];
const SORTS: PropertySort[] = ['newest', 'price_asc', 'price_desc'];

const CITIES: string[] = (LOCATIONS as { city: string }[]).map((l) => l.city);

/** Numeric text -> filter value. Empty string clears the facet. */
function toNumber(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
}

// Matches web's .bed-chip — used for City, Bedrooms, Bathrooms, Property
// Type. Active state is a light accent tint, not a solid fill (that's
// reserved for Segment, below).
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Matches web's .segment-control / .segment — used for Listing Type and
// Sort, a bordered pill-track with a solid gradient-filled active segment,
// visually distinct from Chip's lighter tint treatment.
function Segment({
  options,
  active,
  onChange,
}: {
  options: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.segmentControl}>
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={styles.segment}>
            {isActive && (
              // Matches web's .segment.active — a diagonal gradient fill,
              // not a flat accent color.
              <LinearGradient
                colors={[colors.accent, colors.accentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export function FilterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { filters, queryFilters, setFilter, reset, priceInvalid, areaInvalid } =
    useFilters();
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // A definite pixel height, not `maxHeight: '88%'` — on native Yoga (unlike
  // browser CSS flexbox, which is far more permissive here) a container
  // sized only by `maxHeight` with no `flex`/`height` can leave its `flex: 1`
  // descendants (KeyboardAvoidingView → ScrollView below) with nothing
  // definite to resolve against, collapsing them to zero height even though
  // the exact same layout renders fine on the web target. Confirmed live:
  // this sheet rendered its full content correctly under react-native-web,
  // which is why that alone didn't catch the collapse.
  const sheetHeight = Math.round(windowHeight * 0.88);
  const styles = useMemo(() => createStyles(colors, sheetHeight), [colors, sheetHeight]);

  // Live count for the CTA. Runs off queryFilters so it's already debounced,
  // and only while the sheet is open. Shares a cache entry with Explore's
  // own count for the same filters — reopening the sheet right after
  // Explore loaded shows the number instantly, no network round-trip.
  const { data: count } = usePropertiesCountQuery(queryFilters, visible);

  // Drag-to-dismiss, driven by react-native-gesture-handler + reanimated
  // (both already app dependencies, so no new one added). The pan is
  // attached only to the grip+header zone below, not the ScrollView body,
  // so it never fights normal scrolling through the filter fields.
  const translateY = useSharedValue(0);

  // A prior dismiss-drag must not leave the sheet visually offset the next
  // time it opens — Modal keeps this component mounted across visibility
  // toggles, so the shared value needs an explicit reset.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const closeSheet = () => onClose();

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > 120 || e.velocityY > 800) {
        translateY.value = withTiming(800, { duration: 200 }, () => {
          runOnJS(closeSheet)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 300 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.container, sheetAnimatedStyle]}>
        <GestureDetector gesture={panGesture}>
          <View>
            <View style={styles.grip} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('search.filtersTitle')}</Text>
              <Pressable onPress={reset} hitSlop={12}>
                <Text style={styles.resetText}>{t('search.reset')}</Text>
              </Pressable>
            </View>
          </View>
        </GestureDetector>

        {/* Price/area fields below use the number pad, which has no "Done"
            button on iOS — without this, the keyboard can sit over the CTA
            or the field itself with no way to see either. Wraps the CTA too
            so it rises with the content instead of staying pinned under the
            keyboard. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          {/* Order matches web's Search.jsx filter sheet exactly: City,
              Listing Type, Price, Surface, Bedrooms, Bathrooms, Sort,
              Property Type. */}
          {/* Web renders City as a <select> dropdown (.filter-select), not a
              chip row — chips are reserved for Bedrooms/Bathrooms/Property
              Type there. SelectField is the RN equivalent of that field. */}
          <Section label={t('search.city')}>
            <SelectField
              value={filters.city ?? ''}
              placeholder={t('search.anyCity')}
              accessibilityLabel={t('search.city')}
              options={[
                { value: '', label: t('search.anyCity') },
                ...CITIES.map((city) => ({ value: city, label: city })),
              ]}
              onChange={(v) => setFilter('city', v || null)}
            />
          </Section>

          <Section label={t('search.listingType')}>
            <Segment
              options={[
                { value: '', label: t('common.all') },
                ...LISTING_TYPES.map((lt) => ({ value: lt, label: t(`search.${lt}`) })),
              ]}
              active={filters.listingType ?? ''}
              onChange={(v) => setFilter('listingType', (v || null) as ListingType | null)}
            />
          </Section>

          <Section label={t('search.priceRange')}>
            <View style={styles.inputRow}>
              <View style={styles.inputField}>
                <MaterialIcons name="euro-symbol" size={14} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={t('search.minPrice')}
                  placeholderTextColor={colors.textSecondary}
                  value={filters.minPrice?.toString() ?? ''}
                  onChangeText={(v) => setFilter('minPrice', toNumber(v))}
                />
              </View>
              <Text style={styles.dash}>—</Text>
              <View style={styles.inputField}>
                <MaterialIcons name="euro-symbol" size={14} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={t('search.maxPrice')}
                  placeholderTextColor={colors.textSecondary}
                  value={filters.maxPrice?.toString() ?? ''}
                  onChangeText={(v) => setFilter('maxPrice', toNumber(v))}
                />
              </View>
            </View>
            {priceInvalid && (
              <Text style={styles.warning}>{t('search.rangeInvalid')}</Text>
            )}
          </Section>

          <Section label={t('search.surface')}>
            <View style={styles.inputRow}>
              <View style={styles.inputField}>
                <MaterialIcons name="open-in-full" size={13} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={t('search.minArea')}
                  placeholderTextColor={colors.textSecondary}
                  value={filters.minArea?.toString() ?? ''}
                  onChangeText={(v) => setFilter('minArea', toNumber(v))}
                />
                <Text style={styles.unit}>m²</Text>
              </View>
              <Text style={styles.dash}>—</Text>
              <View style={styles.inputField}>
                <MaterialIcons name="open-in-full" size={13} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={t('search.maxArea')}
                  placeholderTextColor={colors.textSecondary}
                  value={filters.maxArea?.toString() ?? ''}
                  onChangeText={(v) => setFilter('maxArea', toNumber(v))}
                />
                <Text style={styles.unit}>m²</Text>
              </View>
            </View>
            {areaInvalid && (
              <Text style={styles.warning}>{t('search.rangeInvalid')}</Text>
            )}
          </Section>

          <Section label={t('search.bedrooms')}>
            <View style={styles.row}>
              <Chip
                label={t('search.anyBeds')}
                active={filters.beds == null}
                onPress={() => setFilter('beds', null)}
              />
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={n === 4 ? '4+' : String(n)}
                  active={filters.beds === n}
                  onPress={() => setFilter('beds', n)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.bathrooms')}>
            <View style={styles.row}>
              <Chip
                label={t('search.anyBaths')}
                active={filters.baths == null}
                onPress={() => setFilter('baths', null)}
              />
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={n === 4 ? '4+' : String(n)}
                  active={filters.baths === n}
                  onPress={() => setFilter('baths', n)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('search.sortLabel')}>
            <Segment
              options={SORTS.map((s) => ({ value: s, label: t(`search.sort.${s}`) }))}
              active={filters.sort ?? 'newest'}
              onChange={(v) => setFilter('sort', v as PropertySort)}
            />
          </Section>

          <Section label={t('search.typology')}>
            <View style={styles.row}>
              <Chip
                label={t('common.all')}
                active={!filters.propertyType}
                onPress={() => setFilter('propertyType', null)}
              />
              {PROPERTY_TYPES.map((pt) => (
                <Chip
                  key={pt}
                  label={t(`search.${pt}`)}
                  active={filters.propertyType === pt}
                  onPress={() => setFilter('propertyType', pt)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        <Pressable style={styles.cta} onPress={onClose}>
          <LinearGradient
            colors={[colors.accent, colors.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          />
          <Text style={styles.ctaText}>
            {count == null
              ? t('common.loading')
              : t('search.showHomes', { count })}
          </Text>
        </Pressable>
        </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AtticoPalette, sheetHeight: number = 0) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    // A definite height (not `maxHeight`) — see the comment at sheetHeight's
    // definition above for why the percentage version could collapse the
    // flex:1 content below it to zero height on native. Still leaves a peek
    // of the backdrop above the sheet, same "there's a card sitting on top
    // of the screen" read as the web sheet's max-height, and gives the drag
    // gesture room to move before it must dismiss.
    height: sheetHeight,
    // Matches web's .filter-sheet: border-radius: var(--r-2xl) (28px).
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.primary,
  },
  flex: {
    flex: 1,
  },
  grip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    // 0, not a padding value — the first Section's own 24px marginTop below
    // supplies the gap after this row, matching web's `.filter-sheet__header
    // { margin-bottom: 24px }` instead of stacking two gaps on top of it.
    paddingBottom: 0,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  // Matches web's reset link: 13px, regular weight, no bold override.
  resetText: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: colors.accent,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  // Matches web's .filter-section { margin-bottom: 24px } — applied here as
  // marginTop instead (RN sections don't collapse adjacent margins the way
  // CSS does), which gives the same 24px rhythm between every section only
  // once the header's own paddingBottom above is 0.
  section: {
    marginTop: 24,
  },
  // Matches web's .filter-label — no explicit font-weight there (JetBrains
  // Mono's own regular weight), not a bolded override.
  sectionLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  // Matches web's .bed-chip — a light accent tint when active, not a solid
  // fill (Segment, below, is the one that fills solid). padding: 9px 18px.
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  chipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: Fonts?.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.accent,
  },
  // Matches web's .segment-control / .segment.
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    // Clips the active LinearGradient fill (rendered by Segment above) to
    // this pill's own corner radius instead of a square edge.
    overflow: 'hidden',
  },
  segmentText: {
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Matches web's .range-input — an icon (and, for area, a unit suffix)
  // living inside the same bordered pill as the number field, not a bare
  // input with no affordance for what unit is expected.
  inputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: Fonts?.sans,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  unit: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dash: {
    fontFamily: Fonts?.sans,
    color: colors.textSecondary,
  },
  warning: {
    fontFamily: Fonts?.sans,
    marginTop: 8,
    fontSize: 12,
    color: '#E74C3C',
  },
  // Matches web's .cta-pill: 54px tall, gradient fill (not flat), pill
  // radius, plus the app's standard CTA shadow.
  cta: {
    height: 54,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  ctaText: {
    fontFamily: Fonts?.sansBold,
    fontSize: 16,
    // Always white — this sits on a solid orange gradient in both themes,
    // unlike colors.textPrimary which flips dark/light with the theme.
    color: '#fff',
  },
});
