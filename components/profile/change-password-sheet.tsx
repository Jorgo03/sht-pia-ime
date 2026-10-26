import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { User } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { OtpInput, OTP_LENGTH } from '@/components/ui/otp-input';
import { SheetCloseButton } from '@/components/ui/sheet-close-button';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { webColumn } from '@/constants/web-frame';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { friendlyError, retryAfterSeconds } from '@/src/lib/authErrors';
import { hasPasswordSignIn, newPasswordError, providerLabels } from '@/src/features/auth/lib/password';

type Step = 'form' | 'code' | 'new' | 'done';

/**
 * Change the password while signed in: the phone twin of web's
 * ChangePasswordSheet. The current password is checked on the server first
 * and the other devices are signed out after. Forgot the current one: a code
 * by email opens a recovery session, and the new password is set right here.
 * Google- or Apple-only accounts have no password here and are told so.
 * Passwords live in this sheet's state only while it is open.
 */
export function ChangePasswordSheet({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { changePassword, resetPassword, verifyRecoveryCode, updatePassword } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const working = useRef(false);
  const email = user.email ?? '';

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown > 0]);

  // One request at a time, whatever fired it (a double tap, the keyboard's Done).
  const once = async (fn: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const finish = (signedOut: boolean) => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setOthersSignedOut(signedOut);
    setStep('done');
  };

  const save = () => {
    setError('');
    if (!current) return setError(t('errors.passwordRequired'));
    const invalid = newPasswordError(next, confirm, { current });
    if (invalid) return setError(t(invalid));
    once(async () => {
      const result = await changePassword(current, next);
      if (result.status === 'wrongCurrent') return setError(t('errors.currentPasswordWrong'));
      if (result.status === 'failed') return setError(friendlyError(result.error as never, t));
      finish(result.othersSignedOut);
    });
  };

  const sendCode = () =>
    once(async () => {
      setError('');
      const { error: sendError } = await resetPassword(email);
      const wait = retryAfterSeconds(sendError);
      if (wait) {
        setCodeSent(true);
        setCooldown(wait);
        return setError(t('errors.waitSeconds', { s: wait }));
      }
      if (sendError) return setError(friendlyError(sendError, t));
      setCodeSent(true);
      setCooldown(30);
    });

  const verify = (value: string) => {
    if (value.length < OTP_LENGTH) return;
    once(async () => {
      const { error: verifyError } = await verifyRecoveryCode(email, value);
      if (verifyError) {
        setCode('');
        return setError(friendlyError(verifyError, t));
      }
      setError('');
      setStep('new');
    });
  };

  const saveRecovered = () => {
    setError('');
    const invalid = newPasswordError(next, confirm);
    if (invalid) return setError(t(invalid));
    once(async () => {
      const { error: updateError, othersSignedOut: out } = await updatePassword(next);
      if (updateError) return setError(friendlyError(updateError, t));
      finish(out);
    });
  };

  const passwordField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    kind: 'password' | 'newPassword',
  ) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setError('');
        }}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={kind}
        autoComplete={kind === 'password' ? 'current-password' : 'new-password'}
        accessibilityLabel={label}
        editable={!busy}
      />
    </>
  );

  const showToggle = (
    <Pressable
      onPress={() => setShow((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ selected: show }}
      hitSlop={8}
      style={styles.showRow}>
      <MaterialIcons name={show ? 'visibility-off' : 'visibility'} size={18} color={colors.textSecondary} />
      <Text style={styles.link}>{show ? t('auth.hidePassword') : t('auth.showPassword')}</Text>
    </Pressable>
  );

  const errorText = error ? (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;

  let body;
  if (!hasPasswordSignIn(user)) {
    body = (
      <>
        <Text style={styles.text}>{t('security.providerOnly', { providers: providerLabels(user).join(', ') })}</Text>
        <PrimaryCTA label={t('common.done')} icon={null} onPress={onClose} />
      </>
    );
  } else if (step === 'done') {
    body = (
      <View accessibilityLiveRegion="polite">
        <Text style={styles.success}>{t('security.success')}</Text>
        {othersSignedOut ? <Text style={styles.text}>{t('security.othersSignedOut')}</Text> : null}
        <PrimaryCTA label={t('common.done')} icon={null} onPress={onClose} />
      </View>
    );
  } else if (step === 'code') {
    body = (
      <>
        <Text style={styles.text}>{t('security.codeIntro', { email })}</Text>
        {codeSent ? (
          <>
            <OtpInput
              value={code}
              error={!!error}
              editable={!busy}
              onChange={(v) => {
                setCode(v);
                setError('');
              }}
              onComplete={verify}
            />
            <Pressable onPress={sendCode} disabled={busy || cooldown > 0} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, cooldown > 0 && styles.muted]}>
                {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
              </Text>
            </Pressable>
          </>
        ) : (
          <PrimaryCTA label={busy ? t('common.loading') : t('auth.sendCode')} icon={null} loading={busy} onPress={sendCode} />
        )}
        {errorText}
        <GhostBtn label={t('common.back')} onPress={() => { setStep('form'); setError(''); }} />
      </>
    );
  } else if (step === 'new') {
    body = (
      <>
        {passwordField(t('auth.newPassword'), next, setNext, 'newPassword')}
        {passwordField(t('auth.confirmPassword'), confirm, setConfirm, 'newPassword')}
        {showToggle}
        {errorText}
        <PrimaryCTA label={busy ? t('common.loading') : t('security.save')} icon="check" loading={busy} onPress={saveRecovered} />
      </>
    );
  } else {
    body = (
      <>
        {passwordField(t('security.currentPassword'), current, setCurrent, 'password')}
        {passwordField(t('auth.newPassword'), next, setNext, 'newPassword')}
        <Text style={styles.hint}>{t('errors.passwordMin')}</Text>
        {passwordField(t('auth.confirmPassword'), confirm, setConfirm, 'newPassword')}
        {showToggle}
        {errorText}
        <PrimaryCTA label={busy ? t('common.loading') : t('security.save')} icon="check" loading={busy} onPress={save} />
        <Pressable onPress={() => { setStep('code'); setError(''); }} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{t('security.forgotCurrent')}</Text>
        </Pressable>
      </>
    );
  }

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
              {t('security.title')}
            </Text>
            <SheetCloseButton onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {body}
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
    hint: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary },
    text: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginBottom: Spacing.sm },
    success: { fontFamily: Fonts.sansSemiBold, fontSize: 16, color: colors.textPrimary, marginBottom: Spacing.sm },
    showRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
    link: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accent, minHeight: 44, textAlignVertical: 'center', paddingVertical: 12 },
    muted: { color: colors.textSecondary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
