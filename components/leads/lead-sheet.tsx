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
import { webColumn } from '@/constants/web-frame';
import { useTheme } from '@/contexts/theme-context';
import {
  LEAD_LIMITS,
  LEAD_STATUSES,
  leadRow,
  type LeadError,
  type LeadRow,
  type LeadStatus,
} from '@/src/features/leads/lib/leads';

export interface Lead extends LeadRow {
  id: string;
  agent_id: string;
  created_at: string;
}

type FormError = LeadError | 'saveFailed' | null;

/**
 * Add or edit one lead: name, phone, email, notes and where it is in the
 * pipeline (docs/BSP_CRM_ANALYSIS.md, phase 1). The parent mounts it only
 * while open, so every opening starts from the saved lead.
 */
export function LeadSheet({
  lead,
  onSave,
  onClose,
}: {
  /** null: a new lead. */
  lead: Lead | null;
  /** Saves the row; false when the database refused it. */
  onSave: (row: LeadRow) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(lead?.name ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? 'new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError>(null);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };

  const submit = async () => {
    if (saving) return;
    const { row, error: invalid } = leadRow({ name, phone, email, notes, status });
    if (!row) {
      setError(invalid);
      return;
    }
    setSaving(true);
    const ok = await onSave(row);
    setSaving(false);
    if (!ok) {
      setError('saveFailed');
      return;
    }
    onClose();
  };

  const errorText = error ? t(`leads.${error}`) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, webColumn]}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {lead ? t('leads.editTitle') : t('leads.addTitle')}
            </Text>
            <SheetCloseButton onPress={onClose} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('leads.name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={edit(setName)}
              maxLength={LEAD_LIMITS.name}
              autoComplete="name"
              textContentType="name"
              accessibilityLabel={t('leads.name')}
            />
            <Text style={styles.label}>{t('leads.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={edit(setPhone)}
              maxLength={LEAD_LIMITS.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="+355 69 123 4567"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('leads.phone')}
            />
            <Text style={styles.label}>{t('leads.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={edit(setEmail)}
              maxLength={LEAD_LIMITS.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel={t('leads.email')}
            />
            <Text style={styles.label}>{t('leads.statusLabel')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {LEAD_STATUSES.map((s) => {
                const active = s === status;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => setStatus(s)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`leads.status.${s}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>{t('leads.notes')}</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={edit(setNotes)}
              maxLength={LEAD_LIMITS.notes}
              multiline
              textAlignVertical="top"
              placeholder={t('leads.notesHint')}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('leads.notes')}
            />
            {errorText ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {errorText}
              </Text>
            ) : null}
            <PrimaryCTA
              label={saving ? t('common.loading') : t('common.save')}
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
      maxHeight: '92%',
    },
    grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    title: { fontFamily: Fonts.serifSemiBold, fontSize: 22, color: colors.textPrimary },
    body: { padding: Spacing.xl, gap: Spacing.sm },
    label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary, marginTop: Spacing.sm },
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
    notes: { minHeight: 96, paddingTop: Spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    chipTextActive: { color: '#fff' },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
