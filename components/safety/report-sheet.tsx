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

import { SheetCloseButton } from '@/components/ui/sheet-close-button';
import { PrimaryCTA } from '@/components/ui/buttons';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import {
  MAX_REPORT_DETAILS,
  REPORT_REASONS,
  fileReport,
  type ReportReason,
  type ReportResult,
} from '@/src/features/safety/lib/safety';
import { sheetColumn } from '@/constants/web-frame';

/**
 * Report a listing (propertyId) or a person (userId) — the phone twin of
 * web's ReportSheet. Shown only to a signed-in user; the parent checks that.
 */
export function ReportSheet({
  visible,
  propertyId,
  userId,
  onClose,
}: {
  visible: boolean;
  propertyId?: string | null;
  userId?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const close = () => {
    setReason(null);
    setDetails('');
    setResult(null);
    onClose();
  };

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    setResult(await fileReport(supabase, { propertyId, userId, reason, details }));
    setSending(false);
  };

  const title = propertyId ? t('safety.reportListing') : t('safety.reportUser');
  const done = result === 'sent' || result === 'already';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={close} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, sheetColumn]}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <SheetCloseButton onPress={close} />
          </View>

          {done ? (
            <View style={styles.body}>
              <Text style={styles.doneText} accessibilityLiveRegion="polite">
                {result === 'sent' ? t('safety.sent') : t('safety.already')}
              </Text>
              <PrimaryCTA label={t('common.close')} icon="check" onPress={close} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.question}>{t('safety.reportTitle')}</Text>
              <View accessibilityRole="radiogroup" style={styles.reasons}>
                {REPORT_REASONS.map((r) => {
                  const on = reason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => {
                        setReason(r);
                        setResult(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.reason, on && styles.reasonOn]}>
                      <MaterialIcons
                        name={on ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={on ? colors.accent : colors.textSecondary}
                      />
                      <Text style={styles.reasonText}>{t(`safety.reason.${r}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.details}
                placeholder={t('safety.detailsPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={details}
                onChangeText={setDetails}
                maxLength={MAX_REPORT_DETAILS}
                multiline
                textAlignVertical="top"
              />
              {result === 'failed' ? <Text style={styles.error}>{t('safety.failed')}</Text> : null}
              <PrimaryCTA
                label={sending ? t('common.loading') : t('safety.send')}
                icon="flag"
                loading={sending}
                disabled={!reason || sending}
                onPress={submit}
              />
            </ScrollView>
          )}
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
    question: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
    reasons: { gap: Spacing.sm },
    reason: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    reasonOn: { borderColor: colors.accent },
    reasonText: { fontFamily: Fonts.sans, fontSize: 15, color: colors.textPrimary, flex: 1 },
    details: {
      minHeight: 88,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      padding: Spacing.md,
      fontFamily: Fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
    doneText: { fontFamily: Fonts.sans, fontSize: 16, color: colors.textPrimary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
