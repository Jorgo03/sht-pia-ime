import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { pickAvatar } from '@/lib/upload';
import { removeAvatar, saveAvatar } from '@/src/features/auth/lib/avatar';
import {
  PROFILE_LIMITS,
  profilePatch,
  saveProfile,
  type ProfileError,
  type ProfileFields,
} from '@/src/features/auth/lib/profileForm';

type FormError = ProfileError | 'failed' | null;
type PhotoError = 'photoType' | 'photoSize' | 'photoFailed' | 'photoPermission' | null;

/**
 * Edit your photo, name, phone and (agents) agency — the phone twin of web's
 * EditProfileSheet (docs/LAUNCH_TASKS.md L12/F12). Only changed fields are
 * sent; the photo saves on its own as soon as it is picked or removed.
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
  profile: (ProfileFields & { avatar_url?: string | null }) | null;
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<PhotoError>(null);

  const changePhoto = async () => {
    if (photoBusy) return;
    setPhotoError(null);
    const picked = await pickAvatar();
    if ('error' in picked) {
      if (picked.error === 'canceled') return;
      setPhotoError(
        picked.error === 'type' ? 'photoType' : picked.error === 'permission' ? 'photoPermission' : 'photoFailed',
      );
      return;
    }
    setPhotoBusy(true);
    const res = await saveAvatar(supabase, userId, picked.blob, photoUrl);
    setPhotoBusy(false);
    if (res.status !== 'saved') {
      setPhotoError(res.status === 'tooLarge' ? 'photoSize' : 'photoFailed');
      return;
    }
    setPhotoUrl(res.url);
    await onSaved();
  };

  const clearPhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    const result = await removeAvatar(supabase, userId, photoUrl);
    setPhotoBusy(false);
    if (result !== 'saved') {
      setPhotoError('photoFailed');
      return;
    }
    setPhotoUrl(null);
    await onSaved();
  };

  const photoErrorText = photoError
    ? {
        photoType: t('profile.edit.photoType'),
        photoSize: t('profile.edit.photoSize'),
        photoFailed: t('profile.edit.photoFailed'),
        photoPermission: t('profile.edit.photoPermission'),
      }[photoError]
    : null;
  const initial = (fullName.trim()[0] ?? '?').toUpperCase();

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
            <View style={styles.photoRow}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" accessibilityLabel={t('profile.edit.photo')} />
              ) : (
                <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.photo}>
                  <Text style={styles.photoInitial}>{initial}</Text>
                </LinearGradient>
              )}
              <View style={styles.photoActions}>
                <Pressable
                  onPress={changePhoto}
                  disabled={photoBusy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: photoBusy, busy: photoBusy }}
                  style={styles.photoBtn}>
                  <Text style={styles.photoBtnText}>{photoBusy ? t('common.loading') : t('profile.edit.changePhoto')}</Text>
                </Pressable>
                {photoUrl ? (
                  <Pressable onPress={clearPhoto} disabled={photoBusy} accessibilityRole="button" style={styles.photoBtn}>
                    <Text style={styles.photoBtnText}>{t('profile.edit.removePhoto')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {photoErrorText ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {photoErrorText}
              </Text>
            ) : null}
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
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
    photo: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    photoInitial: { fontFamily: Fonts.serifSemiBold, fontSize: 28, color: '#fff' },
    photoActions: { flex: 1, gap: Spacing.sm },
    photoBtn: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    photoBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
