import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryCTA } from '@/components/ui/buttons';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { SheetCloseButton } from '@/components/ui/sheet-close-button';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { sheetColumn } from '@/constants/web-frame';
import { useTheme } from '@/contexts/theme-context';
import type { Baseline } from '@/hooks/use-performance-report';
import { parseEstimate } from '@/src/lib/performanceReport';

const FIELDS = ['monthly_rentals', 'monthly_sales', 'monthly_inquiries', 'monthly_viewings'] as const;
type FieldKey = (typeof FIELDS)[number];
const ROW_KEY: Record<FieldKey, string> = {
  monthly_rentals: 'rentals',
  monthly_sales: 'sales',
  monthly_inquiries: 'inquiries',
  monthly_viewings: 'viewings',
};

const asText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/**
 * The agent's own estimate of their monthly results before Shtëpia.ime.
 * Every value is optional, and the agent must tick that these are their own
 * figures before they are saved: the report keeps them apart from what the
 * app records.
 */
export function BaselineSheet({
  visible,
  initial,
  saving,
  failed,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: Baseline | null;
  saving: boolean;
  failed: boolean;
  onSave: (values: Omit<Baseline, 'updated_at'>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The parent remounts this sheet on each opening (a new `key`), so every
  // opening starts from what is saved, unconfirmed.
  const [text, setText] = useState<Record<FieldKey, string>>(() => ({
    monthly_rentals: asText(initial?.monthly_rentals),
    monthly_sales: asText(initial?.monthly_sales),
    monthly_inquiries: asText(initial?.monthly_inquiries),
    monthly_viewings: asText(initial?.monthly_viewings),
  }));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<'invalid' | 'mustConfirm' | null>(null);

  const submit = () => {
    const parsed = Object.fromEntries(FIELDS.map((k) => [k, parseEstimate(text[k])])) as Record<FieldKey, number | null | undefined>;
    if (FIELDS.some((k) => parsed[k] === undefined)) {
      setError('invalid');
      return;
    }
    if (!confirmed) {
      setError('mustConfirm');
      return;
    }
    setError(null);
    onSave(parsed as Record<FieldKey, number | null>);
  };

  const message = failed ? t('performance.baseline.saveFailed') : error ? t(`performance.baseline.${error}`) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, sheetColumn]}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('performance.baseline.title')}
            </Text>
            <SheetCloseButton onPress={onClose} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>{t('performance.baseline.hint')}</Text>
            {FIELDS.map((key) => (
              <View key={key} style={styles.fieldRow}>
                <Text style={styles.label}>{t(`performance.impact.rows.${ROW_KEY[key]}`)}</Text>
                <TextInput
                  style={styles.input}
                  value={text[key]}
                  onChangeText={(v) => {
                    setText((prev) => ({ ...prev, [key]: v }));
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={7}
                  placeholder={t('performance.impact.notEntered')}
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel={t(`performance.impact.rows.${ROW_KEY[key]}`)}
                />
              </View>
            ))}

            <Pressable
              style={styles.confirmRow}
              onPress={() => {
                setConfirmed((c) => !c);
                setError(null);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}>
              <MaterialIcons
                name={confirmed ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={confirmed ? colors.accent : colors.textSecondary}
              />
              <Text style={styles.confirmText}>{t('performance.baseline.confirm')}</Text>
            </Pressable>

            {message ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}

            <PrimaryCTA
              label={saving ? t('common.loading') : t('performance.baseline.save')}
              icon="check"
              loading={saving}
              disabled={saving}
              onPress={submit}
            />
          </ScrollView>
          <KeyboardDoneBar />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.primaryLight,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: '90%',
    },
    grip: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    title: { fontFamily: Fonts.serifSemiBold, fontSize: 22, color: colors.textPrimary },
    body: { padding: Spacing.xl, gap: Spacing.md },
    hint: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    fieldRow: { gap: 6 },
    label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    input: {
      minHeight: 48,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      paddingHorizontal: Spacing.md,
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: colors.textPrimary,
    },
    confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
    confirmText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: colors.textPrimary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
