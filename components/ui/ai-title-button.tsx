import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { generateListing, type AiError, type ListingDetails } from '@/lib/ai';
import { type LangCode } from '@/lib/translate';

interface AiTitleButtonProps {
  /** Whatever the form has so far; used as grounding for the model. */
  details: ListingDetails;
  language?: LangCode;
  /** Receives the suggested title. The caller writes it into the field, which
   *  stays fully editable — nothing is auto-submitted or locked. */
  onResult: (title: string) => void;
}

/**
 * Title-only AI generation. Calls the same ai-generate-listing Edge Function
 * the web wizard uses and applies just the title, leaving the description the
 * agent wrote untouched. Styled after web's `.ai-panel__btn` gradient chip.
 */
export function AiTitleButton({
  details,
  language = 'sq',
  onResult,
}: AiTitleButtonProps) {
  const { t } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Without a type and a city there isn't enough to ground a useful title, so
  // block the call up front rather than spending a request on a vague one.
  const missingContext = !details.property_type || !details.city?.trim();

  const handlePress = async () => {
    if (loading || missingContext) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateListing(details, language);
      onResult(result.title);
    } catch (err) {
      const code = (err as AiError)?.code;
      setError(
        code === 'rate_limited'
          ? t('ai.errorRateLimited')
          : t('ai.errorUnavailable'),
      );
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || missingContext;

  return (
    <View>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityLabel={t('ai.generateTitle')}
        style={disabled && styles.disabled}>
        <LinearGradient
          colors={[colors.orange1, colors.orange2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { borderRadius: radii.sm }]}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="auto-awesome" size={16} color="#fff" />
          )}
          <Text style={[styles.text, { fontFamily: fonts.sansSemiBold }]}>
            {loading ? t('ai.generating') : t('ai.generateTitle')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {missingContext && (
        <Text style={[styles.hint, { fontFamily: fonts.sans, color: colors.textMuted }]}>
          {t('ai.titleNeedsFields')}
        </Text>
      )}
      {error && (
        <Text style={[styles.error, { fontFamily: fonts.sans, color: colors.statusSold }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: 13,
    color: '#fff',
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
  },
});
