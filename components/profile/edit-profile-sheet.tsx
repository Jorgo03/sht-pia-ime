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
import { KEYBOARD_DONE_SHEET_ID, KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import {
  PROFILE_LIMITS,
  profilePatch,
  saveProfile,
  type ProfileError,
  type ProfileFields,
} from '@/src/features/auth/lib/profileForm';

type FormError = ProfileError | 'failed' | null;

/**
 * Edit your name, phone and (agents) agency — the phone twin of web's
 * EditProfileSheet (docs/LAUNCH_TASKS.md L12). Only changed fields are sent.
 */
export function EditProfileSheet({
  visible,
  userId,
  profile,
  isAgent,
  onSaved,
  onClose,
}: {
  visible: boolean;
  userId: string;
  profile: ProfileFields | null;
  isAgent: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The parent mounts the sheet only while it is open, so each opening starts
  // from the saved profile and a cancelled edit never lingers.
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [agency, setAgency] = useState(profile?.agency_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError>(null);

  const submit = async () => {
    if (saving) return;
    const { patch, error: invalid } = profilePatch(
      profile,
      { full_name: fullName, phone, agency_name: agency },
      { isAgent },
    );
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    const result = await saveProfile(supabase, userId, patch);
    setSaving(false);
    if (result === 'failed') {
      setError('failed');
      return;
    }
    if (result === 'saved') await onSaved();
    onClose();
  };

  const errorText = error
    ? {
        nameRequired: t('profile.edit.nameRequired'),
        tooLong: t('profile.edit.tooLong'),
        phoneInvalid: t('profile.edit.phoneInvalid'),
        failed: t('profile.edit.failed'),
      }[error]
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('profile.edit.title')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('auth.fullName')}</Text>
            <TextInput
              inputAccessoryViewID={KEYBOARD_DONE_SHEET_ID}
              style={styles.input}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                setError(null);
              }}
              maxLength={PROFILE_LIMITS.full_name}
              autoComplete="name"
              textContentType="name"
              accessibilityLabel={t('auth.fullName')}
            />
            {isAgent ? (
              <>
                <Text style={styles.label}>{t('auth.agencyName')}</Text>
                <TextInput
                  inputAccessoryViewID={KEYBOARD_DONE_SHEET_ID}
                  style={styles.input}
                  value={agency}
                  onChangeText={(v) => {
                    setAgency(v);
                    setError(null);
                  }}
                  maxLength={PROFILE_LIMITS.agency_name}
                  textContentType="organizationName"
                  accessibilityLabel={t('auth.agencyName')}
                />
              </>
            ) : null}
            <Text style={styles.label}>{t('profile.edit.phone')}</Text>
            <TextInput
              inputAccessoryViewID={KEYBOARD_DONE_SHEET_ID}
              style={styles.input}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setError(null);
              }}
              maxLength={PROFILE_LIMITS.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="+355 69 123 4567"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('profile.edit.phone')}
              accessibilityHint={isAgent ? t('profile.edit.phoneHintAgent') : t('profile.edit.phoneHintClient')}
            />
            <Text style={styles.hint}>
              {isAgent ? t('profile.edit.phoneHintAgent') : t('profile.edit.phoneHintClient')}
            </Text>
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
          <KeyboardDoneBar nativeID={KEYBOARD_DONE_SHEET_ID} />
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
    hint: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
