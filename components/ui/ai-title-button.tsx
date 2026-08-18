import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
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
 * agent wrote untouched.
 */
export function AiTitleButton({
  details,
  language = 'sq',
  onResult,
}: AiTitleButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        style={[styles.button, disabled && styles.disabled]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityLabel={t('ai.generateTitle')}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <MaterialIcons
            name="auto-awesome"
            size={16}
            color={colors.accent}
          />
        )}
        <Text style={styles.text}>
          {loading ? t('ai.generating') : t('ai.generateTitle')}
        </Text>
      </TouchableOpacity>

      {missingContext && <Text style={styles.hint}>{t('ai.titleNeedsFields')}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    color: '#E74C3C',
  },
});
