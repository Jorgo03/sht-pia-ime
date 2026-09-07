import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/ui/field';
import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { searchRoads, type RoadSuggestion } from '@/src/lib/roadSearch';

const DEBOUNCE_MS = 450;
const MIN_QUERY = 2;

interface RoadFieldProps {
  /** Free text currently in the field — this stays the source of truth. */
  value: string;
  onChangeText: (value: string) => void;
  /** Geographic context. With no city there is nothing to search within. */
  city: string;
  /**
   * A road was picked from the list. Carries the road's coordinates so the map
   * can move there — deliberately separate from the property's own position,
   * which only the marker sets.
   */
  onSelectRoad: (road: RoadSuggestion) => void;
  placeholder?: string;
}

/**
 * Road/street input with suggestions for the selected city.
 *
 * The field stays a plain text input: Albanian addresses are frequently
 * informal ("prapa shkollës"), OSM coverage outside Tirana is patchy, and the
 * product has never required a road. Suggestions are an accelerator layered on
 * top — pick one and it fills itself in, ignore them and type whatever you
 * like. Nothing here can block a publish.
 *
 * Debounced at 450ms and only from two characters, which is both a courtesy to
 * Nominatim's ~1 req/s policy and the difference between a list that settles
 * and one that flickers on every keystroke.
 */
export function RoadField({
  value,
  onChangeText,
  city,
  onSelectRoad,
  placeholder,
}: RoadFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [suggestions, setSuggestions] = useState<RoadSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  /** Set while a suggestion is being applied, so writing the name back into
   *  the field does not immediately search for it and reopen the list. */
  const justPickedRef = useRef(false);

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (!open || !city || value.trim().length < MIN_QUERY) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const roads = await searchRoads({ city, query: value, signal: controller.signal });
      if (controller.signal.aborted) return;
      setSuggestions(roads);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      // Leaving `loading` true here would strand a spinner when the effect is
      // torn down by the next keystroke; the new run sets it again immediately.
      setLoading(false);
    };
  }, [value, city, open]);

  // A city change invalidates every suggestion on screen — they belong to the
  // previous city and picking one would move the map to the wrong place.
  useEffect(() => {
    setSuggestions([]);
    setOpen(false);
  }, [city]);

  const pick = (road: RoadSuggestion) => {
    justPickedRef.current = true;
    onChangeText(road.name);
    onSelectRoad(road);
    setSuggestions([]);
    setOpen(false);
  };

  const showList = open && (loading || suggestions.length > 0);

  return (
    <View>
      <Field
        icon="place"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setOpen(true)}
        autoCorrect={false}
        trailing={loading ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
      />

      {!city && (
        <Text style={styles.hint}>{t('listing.roadNeedsCity')}</Text>
      )}

      {showList && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
            nestedScrollEnabled>
            {suggestions.map((road) => (
              <Pressable
                key={`${road.name}-${road.latitude}-${road.longitude}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pick(road)}>
                <MaterialIcons name="place" size={16} color={colors.accent} />
                <View style={styles.rowText}>
                  <Text style={styles.roadName} numberOfLines={1}>
                    {road.name}
                  </Text>
                  {!!road.context && (
                    <Text style={styles.roadContext} numberOfLines={1}>
                      {road.context}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
            {!loading && suggestions.length === 0 && (
              <Text style={styles.empty}>{t('listing.roadNoResults')}</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    dropdown: {
      marginTop: 6,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    // Capped rather than unbounded: the list sits above the map, and a long
    // one would push the marker off screen just as it becomes relevant.
    scroll: { maxHeight: 190 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowText: { flex: 1 },
    roadName: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    roadContext: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    empty: {
      fontFamily: Fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      padding: 13,
    },
    hint: { marginTop: 6, fontSize: 12, color: colors.textSecondary, fontFamily: Fonts.sans },
  });
