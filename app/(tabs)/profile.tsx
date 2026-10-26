import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Provider } from '@supabase/supabase-js';

import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal';
import { IS_WEB } from '@/constants/web-frame';
import { isModerator } from '@/src/features/moderation/lib/moderation';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette, Fonts, Radii } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useFavorites } from '@/contexts/favorites-context';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { useTheme } from '@/contexts/theme-context';
import { useTabBarClearance } from '@/components/liquid-tab-bar';
import { AppHeader } from '@/components/ui/app-header';
import { EditProfileSheet } from '@/components/profile/edit-profile-sheet';
import { NotificationsSheet } from '@/components/profile/notifications-sheet';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { DuskHero } from '@/components/ui/dusk-hero';
import { GoogleLogo } from '@/components/ui/google-logo';
import { GradientBackground } from '@/components/ui/gradient-background';
import { OtpInput, OTP_LENGTH } from '@/components/ui/otp-input';
// One mapper for both apps (error codes first, then Supabase's text).
import { friendlyError as friendlyAuthError, retryAfterSeconds } from '@/src/lib/authErrors';
import { newPasswordError, passwordStrengthError } from '@/src/features/auth/lib/password';
import { providerEnabled } from '@/src/features/auth/lib/authLinks';
import { ChangePasswordSheet } from '@/components/profile/change-password-sheet';
import { useProfileStats } from '@/hooks/use-profile-stats';
import type { ProfileFields } from '@/src/features/auth/lib/profileForm';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

type Role = 'buyer' | 'agent';

/** Seconds the resend link stays locked after a code goes out — same 30 web uses. */
const RESEND_COOLDOWN_S = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    user,
    profile,
    isAgent: isAgentAccount,
    refreshProfile,
    signIn,
    signUp,
    signOut,
    signInWithProvider,
    sendOtp,
    verifyOtp,
    resendCode,
    resetPassword,
    verifyRecoveryCode,
    updatePassword,
    loading: authLoading,
  } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Replaces the hardcoded 110 these scrolls used to carry — that was
  // eyeballed against one device's home-indicator inset and came up short on
  // any phone with a larger one.
  const tabBarClearance = useTabBarClearance();
  const unreadMessages = useUnreadMessages();
  const { favoriteProperties } = useFavorites();
  const stats = useProfileStats();

  // Website only: a "Moderation" row for people in public.moderators (the
  // page itself is web only, and the database enforces the same rule).
  const [canModerate, setCanModerate] = useState(false);
  useEffect(() => {
    if (!IS_WEB || !user) return;
    let active = true;
    isModerator(supabase).then((ok) => {
      if (active) setCanModerate(ok);
    });
    return () => {
      active = false;
    };
  }, [user]);

  // On the website the documents are this app's own pages; the phone apps
  // open them on the website (lib/legal.ts).
  const openLegal = (doc: 'privacy' | 'terms') => {
    if (IS_WEB) router.push(`/${doc}` as Href);
    else Linking.openURL(doc === 'privacy' ? PRIVACY_POLICY_URL : TERMS_URL);
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<Role>('buyer');
  const [loading, setLoading] = useState(false);
  // Tracks which provider button is mid-redirect, so the others stay usable
  // and a double-tap on the same one can't fire a second redirect — mirrors
  // web's single `providerLoading` state rather than one flag per provider.
  const [providerLoading, setProviderLoading] = useState<Provider | null>(null);
  // Email-code (OTP) flow — web's equivalent lives in Profile.jsx's
  // handleGoogleOtp/otpStep state.
  const [otpSending, setOtpSending] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  // Which kind of code the entry step is currently collecting. Supabase
  // rejects a verify whose `type` does not match how the code was issued, so
  // a password signup's confirmation code must be verified as 'signup', not
  // 'email'. This was hardcoded to 'email', which left email+password signup
  // a dead end on mobile: the confirmation code arrived with nowhere in the
  // app to enter it. Mirrors web's Profile.jsx `otpType`.
  const [otpType, setOtpType] = useState<'email' | 'signup'>('email');
  // Reddens the six boxes together after a rejected code, cleared on the next
  // keystroke — same signal web gives via `.otp-digit.error`.
  const [otpError, setOtpError] = useState(false);
  // Seconds left on the resend lock. Web starts this at 30 on every send so a
  // user can't hammer the endpoint into a Supabase rate-limit.
  const [cooldown, setCooldown] = useState(0);
  // Set synchronously, before the button re-renders as busy: a quick double
  // tap would otherwise send two codes (the second silently invalidates the
  // first), or verify one code twice (the second attempt fails as "used").
  const sendingCode = useRef(false);
  const verifyingCode = useRef(false);
  const [resetSending, setResetSending] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // Local copies so TypeScript keeps the null-narrowing inside the onPress
  // closures below — narrowing of an imported binding does not survive one.
  // Account deletion is mandatory for store approval (Apple 5.1.1(v), Google
  // Play data-deletion policy) when an app lets users create accounts.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      // The Edge Function derives the account from the caller's verified
      // access token — nothing identifying is sent in the body.
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      setDeleteOpen(false);
      // The auth user is gone; clear the local session so the app returns to
      // the signed-out state rather than holding a token for a deleted user.
      await signOut();
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  };
  // Password recovery, completed in-app: null → 'email' (which account) →
  // 'code' (the 6 digits from the e-mail) → 'password' (choose a new one).
  // Mirrors the web flow.
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'code' | 'password' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Resend cooldown ticker. Guarded on `cooldown > 0` rather than `cooldown`
  // so it schedules one interval for the whole countdown instead of tearing
  // down and re-creating a timer every second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown > 0]);

  // Mirrors web's validate(): same rules, same order, so the two apps reject
  // (and word) a bad submission identically. Previously this screen only
  // checked for non-empty fields — a malformed email or a 3-character
  // password reached Supabase and came back as a raw, unlocalized error.
  //
  // The 8-char minimum is a signup-time policy, not a login-time one — an
  // existing account may predate this rule with a shorter password, and
  // Supabase's own /token endpoint (not this form) is the authority on
  // whether a login password is correct. This previously applied the
  // signup-only rule unconditionally, so a login with a blank or short
  // password showed "at least 8 characters" instead of a login-appropriate
  // message — same defect web's Profile.jsx had, fixed there first.
  const validateAuth = (): boolean => {
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert(t('common.error'), t('errors.invalidEmail'));
      return false;
    }
    if (isSignUp) {
      const weak = passwordStrengthError(password);
      if (weak) {
        Alert.alert(t('common.error'), t(weak));
        return false;
      }
      if (fullName.trim().length < 2) {
        Alert.alert(t('common.error'), t('errors.nameRequired'));
        return false;
      }
      if (password !== confirmPassword) {
        Alert.alert(t('common.error'), t('errors.passwordMismatch'));
        return false;
      }
    } else if (!password) {
      Alert.alert(t('common.error'), t('errors.passwordRequired'));
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    // Same re-entry guard as web: the button's `disabled` covers taps, but a
    // guard here is what actually makes a second submit impossible regardless
    // of how it was triggered.
    if (loading) return;
    if (!validateAuth()) return;
    const cleanEmail = email.trim();
    setEmail(cleanEmail);
    setLoading(true);
    if (isSignUp) {
      // OAuth and email-code signups can't carry the role toggle through
      // their redirect, so those two paths stash it for applyPendingRole to
      // claim afterward (see handleProvider/handleSendOtp below) — but a
      // password signup passes role straight through signUp's own metadata,
      // so no stash is needed here, and any stale stash from an abandoned
      // OAuth attempt must not leak into this flow.
      try {
        await AsyncStorage.removeItem('fho_pending_role');
      } catch {
        /* ignore */
      }
      const { error, needsConfirmation } = await signUp(cleanEmail, password, {
        role,
        full_name: fullName.trim() || undefined,
        agency_name: role === 'agent' ? agencyName.trim() || undefined : undefined,
      });
      setLoading(false);
      if (error) {
        Alert.alert(t('common.error'), friendlyAuthError(error, t));
      } else if (needsConfirmation) {
        // Straight to code entry, same as web: the confirmation email carries
        // a 6-digit code, and previously this only showed an alert and left
        // the user on the signup form with no way to enter it.
        setOtpType('signup');
        setOtpCode('');
        setOtpError(false);
        setCooldown(RESEND_COOLDOWN_S);
        setOtpStep(true);
        Alert.alert('OK', t('auth.checkEmail'));
      }
      // Otherwise email confirmation is off and signUp already returned a
      // session: the auth listener swaps this screen to the signed-in profile
      // on its own. Showing the code entry here would strand a registered,
      // signed-in user waiting for a mail that is never sent.
    } else {
      const { error } = await signIn(cleanEmail, password);
      setLoading(false);
      if ((error as { code?: string } | null)?.code === 'email_not_confirmed') {
        // Not a dead end: the confirmation code (or a fresh one) finishes it.
        setOtpType('signup');
        setOtpCode('');
        setOtpError(false);
        setCooldown(0);
        setOtpStep(true);
        Alert.alert(t('auth.confirmFirst'));
      } else if (error) {
        Alert.alert(t('common.error'), friendlyAuthError(error, t));
      }
    }
  };

  // Mirrors web's handleGoogleOtp: needs the email field filled first, then
  // swaps the form to code entry rather than navigating away.
  const handleSendOtp = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert(t('common.error'), t('auth.enterEmail'));
      return;
    }
    setEmail(cleanEmail);
    // OTP signups carry no role metadata either — same stash-and-apply path
    // as OAuth (see auth-context's applyPendingRole), and overwriting here
    // means an aborted OAuth click can't leak its role choice into this flow.
    try {
      await AsyncStorage.setItem('fho_pending_role', role);
    } catch {
      /* storage blocked — role stays buyer */
    }
    if (sendingCode.current) return;
    sendingCode.current = true;
    setOtpSending(true);
    const { error } = await sendOtp(cleanEmail).finally(() => {
      sendingCode.current = false;
    });
    setOtpSending(false);
    const wait = retryAfterSeconds(error);
    if (wait) {
      // A code went to this address moments ago and is still valid: go to
      // code entry, and unlock "resend" when the server will accept it.
      setOtpType('email');
      setOtpCode('');
      setOtpError(false);
      setCooldown(wait);
      setOtpStep(true);
      Alert.alert(t('errors.waitSeconds', { s: wait }));
      return;
    }
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    setOtpType('email');
    setOtpCode('');
    setOtpError(false);
    setCooldown(RESEND_COOLDOWN_S);
    setOtpStep(true);
  };

  // Resend is a distinct call from the first send: a code that came from a
  // password signup has to be re-issued as type 'signup', which sendOtp can't
  // do. This screen only ever originates 'email' codes, but going through
  // resendCode keeps the two platforms on one path.
  const handleResendOtp = async () => {
    if (cooldown > 0 || otpSending) return;
    // Same guard web has: `email` can be blank if the screen re-rendered
    // between steps, and resending with an empty address 400s.
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert(t('common.error'), t('errors.invalidEmail'));
      return;
    }
    if (sendingCode.current) return;
    sendingCode.current = true;
    setOtpSending(true);
    const { error } = await resendCode(email.trim(), otpType).finally(() => {
      sendingCode.current = false;
    });
    setOtpSending(false);
    const wait = retryAfterSeconds(error);
    if (wait) {
      setCooldown(wait);
      Alert.alert(t('errors.waitSeconds', { s: wait }));
      return;
    }
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    // Success was previously silent — the only signal was the link text
    // switching to "Resend in 30s", which is easy to miss while waiting on an
    // e-mail, so a working resend read as a broken one. Web already confirmed
    // via auth.otpSent; this brings mobile in line.
    //
    // The stale digits are cleared too: a resend invalidates the previous
    // code, so leaving the old (often wrong) ones on screen invites the user
    // to submit a code that can no longer succeed.
    setOtpCode('');
    setOtpError(false);
    setCooldown(RESEND_COOLDOWN_S);
    // Says that earlier codes stopped working: entering the first email's
    // code after a resend is the common way to hit "wrong or expired".
    Alert.alert(t('auth.newCodeSent'));
  };

  // Takes the code as an argument rather than reading `otpCode` — the
  // auto-verify fires from inside onChangeText, before that state update has
  // flushed, so the state value would still be 5 digits here.
  const handleVerifyOtp = async (code: string) => {
    if (code.length < OTP_LENGTH || verifyingCode.current) return;
    verifyingCode.current = true;
    setOtpVerifying(true);
    const { error } = await verifyOtp(email, code, otpType).finally(() => {
      verifyingCode.current = false;
    });
    setOtpVerifying(false);
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      setOtpCode('');
      setOtpError(true);
      return;
    }
    // A successful verify puts a session in place; AuthProvider's
    // onAuthStateChange swaps this screen to the signed-in dashboard.
    setOtpStep(false);
  };

  // Recovery now completes in-app. The e-mail carries a 6-digit code as well
  // as a link, so verifying that code with type 'recovery' yields a real
  // session and the new password can be set here — no deep link, and no
  // sending the user to the web app to finish, which was a dead end for
  // anyone who only has the app installed.
  // Step A. The answer is the same whether or not the address has an account
  // (Supabase answers 200 either way), so the app never tells a stranger who
  // is registered. Guarded like the other sends: a second reset email would
  // make the first one's code stop working.
  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      Alert.alert(t('common.error'), t('errors.invalidEmail'));
      return;
    }
    if (sendingCode.current) return;
    sendingCode.current = true;
    setEmail(cleanEmail);
    setResetSending(true);
    const { error } = await resetPassword(cleanEmail).finally(() => {
      sendingCode.current = false;
    });
    setResetSending(false);
    const wait = retryAfterSeconds(error);
    if (error && !wait) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    // A code went to this address moments ago and is still valid: go on to
    // the code, with the resend unlocked when the server will take it.
    setOtpCode('');
    setOtpError(false);
    setCooldown(wait ?? RESEND_COOLDOWN_S);
    setRecoveryStep('code');
    Alert.alert(wait ? t('errors.waitSeconds', { s: wait }) : t('auth.resetCodeSent', { email: cleanEmail }));
  };

  const handleVerifyRecovery = async (code: string) => {
    if (code.length < OTP_LENGTH || verifyingCode.current) return;
    verifyingCode.current = true;
    setOtpVerifying(true);
    const { error } = await verifyRecoveryCode(email.trim(), code).finally(() => {
      verifyingCode.current = false;
    });
    setOtpVerifying(false);
    if (error) {
      setOtpCode('');
      setOtpError(true);
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    // The recovery session is live from here; move to setting the password.
    setRecoveryStep('password');
  };

  const handleSetNewPassword = async () => {
    if (loading) return;
    const invalid = newPasswordError(newPassword, confirmNewPassword);
    if (invalid) {
      Alert.alert(t('common.error'), t(invalid));
      return;
    }
    setLoading(true);
    const { error, othersSignedOut } = await updatePassword(newPassword);
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    // verifyOtp already signed the user in, so there is nothing further to do
    // — clear the recovery UI and the signed-in dashboard renders itself.
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryStep(null);
    Alert.alert(t('auth.recoverySuccess'), othersSignedOut ? t('security.othersSignedOut') : undefined);
  };

  const handleResendRecovery = async () => {
    if (cooldown > 0 || resetSending || sendingCode.current) return;
    sendingCode.current = true;
    setResetSending(true);
    const { error } = await resetPassword(email.trim()).finally(() => {
      sendingCode.current = false;
    });
    setResetSending(false);
    const wait = retryAfterSeconds(error);
    if (wait) {
      setCooldown(wait);
      Alert.alert(t('errors.waitSeconds', { s: wait }));
      return;
    }
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
      return;
    }
    setOtpCode('');
    setOtpError(false);
    setCooldown(RESEND_COOLDOWN_S);
    Alert.alert(t('auth.newCodeSent'));
  };

  const handleProvider = async (provider: Provider) => {
    if (providerLoading) return;
    // OAuth can't carry the role toggle through the provider redirect —
    // handle_new_user always defaults a fresh account to 'buyer', so stash
    // the chosen role for auth-context's applyPendingRole to claim once the
    // session lands (5-minute window, new accounts only).
    try {
      await AsyncStorage.setItem('fho_pending_role', role);
    } catch {
      /* storage blocked — role stays buyer */
    }
    setProviderLoading(provider);
    // A provider switched off in the dashboard fails only after the browser
    // round trip (or as a raw error page on the web); say so before that.
    if ((await providerEnabled(supabase, provider)) === false) {
      setProviderLoading(null);
      Alert.alert(t('common.error'), t('errors.providerUnavailable'));
      return;
    }
    const { error } = await signInWithProvider(provider);
    setProviderLoading(null);
    if (error) {
      Alert.alert(t('common.error'), friendlyAuthError(error, t));
    }
    // On success (native): the browser/credential sheet already returned a
    // session and onAuthStateChange swaps this screen away, so there's
    // nothing further to do here on the happy path.
  };

  if (authLoading) return null;

  // The recovery code signs the user in (verifyOtp), so the new-password step
  // must stay on screen with a user present; the dashboard follows once the
  // password is saved or the step is left.
  if (user && recoveryStep !== 'password') {
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '?';
    const initial = (displayName[0] ?? '?').toUpperCase();

    return (
      <GradientBackground>
        <SafeAreaView style={styles.flex} edges={['top']}>
          {/* The signed-in dashboard used to carry its own title row with a
              duplicate theme toggle and language pill — the shared header
              provides both, so this screen now matches web's layout instead
              of running a parallel one. */}
          <AppHeader />
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.topBarTitle} accessibilityRole="header">{t('common.profile')}</Text>

            {/* Matches web's .profile-card exactly. */}
            <View style={styles.profileCard}>
              {typeof profile?.avatar_url === 'string' && profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" accessibilityLabel={displayName} />
              ) : (
                <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
              )}
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{isAgentAccount ? t('auth.agent') : t('auth.user')}</Text>
              </View>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>

            {/* Matches web's .profile-stats — bordered 3-up bar. */}
            <View style={styles.statsBar}>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={styles.statValue}>{stats.loading ? '–' : stats.saved}</Text>
                <Text style={styles.statLabel}>{t('profile.statSaved')}</Text>
              </View>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={styles.statValue}>{stats.loading ? '–' : stats.searches}</Text>
                <Text style={styles.statLabel}>{t('profile.statSearches')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.loading ? '–' : stats.third}</Text>
                <Text style={styles.statLabel}>
                  {isAgentAccount ? t('profile.statListings') : t('profile.statViewings')}
                </Text>
              </View>
            </View>

            {/* Matches web's .profile-settings row list exactly — same rows,
                same order (Favorites, Messages, Saved Searches, Viewings, My
                Listings, [Agent Dashboard]). "New Listing" quick-action was
                dropped: web has no such button here, and the global + in the
                nav pill already covers it. */}
            <View style={styles.menuList}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => setEditOpen(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="edit" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('profile.edit.title')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => setSecurityOpen(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="lock-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('security.row')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => setNotificationsOpen(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="notifications-none" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('notifications.title')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => router.push('/favorites' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="favorite-border" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('common.favorites')}</Text>
                {favoriteProperties.length > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {favoriteProperties.length > 9 ? '9+' : favoriteProperties.length}
                    </Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => router.push('/messages' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="search" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('common.messages')}</Text>
                {unreadMessages > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => router.push('/saved-searches' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="bookmark-border" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('saved.kicker')}</Text>
                {stats.searches > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{stats.searches > 9 ? '9+' : stats.searches}</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => router.push('/viewings' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="calendar-today" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('viewings.kicker')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={() => router.push('/my-listings' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="home-work" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('listing.myListings')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {isAgentAccount && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.menuRow}
                    onPress={() => router.push('/agent-dashboard' as Href)}
                    activeOpacity={0.7}>
                    <MaterialIcons name="bar-chart" size={20} color={colors.textPrimary} />
                    <Text style={styles.menuRowText}>{t('agentDashboard.kicker')}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}
              {canModerate && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.menuRow}
                    onPress={() => router.push('/moderation' as Href)}
                    activeOpacity={0.7}>
                    <MaterialIcons name="verified-user" size={20} color={colors.textPrimary} />
                    <Text style={styles.menuRowText}>{t('moderation.title')}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Signing out is one tap from a scroll — easy to hit by accident,
                and it costs the user their session. Confirm first. */}
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.signOutButton}
              onPress={() => setSignOutOpen(true)}
              activeOpacity={0.8}>
              <MaterialIcons name="logout" size={18} color={colors.signOut} />
              <Text style={styles.signOutText}>{t('common.signOut')}</Text>
            </TouchableOpacity>

            {/* Store-required: the user must be able to start account deletion
                from inside the app. Deliberately the last item, plain text
                rather than a button, so it reads as deliberate and is hard to
                hit by accident — it is irreversible. */}
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.deleteAccountButton}
              onPress={() => { setDeleteError(false); setDeleteOpen(true); }}
              activeOpacity={0.7}>
              <Text style={styles.deleteAccountText}>{t('account.deleteAccount')}</Text>
            </TouchableOpacity>

            {/* Both stores require the Privacy Policy to be reachable from
                inside the app. The pages live on the website (lib/legal.ts). */}
            <View style={styles.legalRow}>
              <Text style={styles.legalLink} accessibilityRole="link" onPress={() => openLegal('privacy')}>
                {t('legal.privacyPolicy')}
              </Text>
              <Text style={styles.legalDot}>·</Text>
              <Text style={styles.legalLink} accessibilityRole="link" onPress={() => openLegal('terms')}>
                {t('legal.termsOfService')}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>

        {notificationsOpen && (
          // Keyed by account: another person never sees, or saves over, the previous one's choices.
          <NotificationsSheet key={user.id} userId={user.id} onClose={() => setNotificationsOpen(false)} />
        )}

        {securityOpen && (
          // Keyed by account, so a password typed for one never shows for another.
          <ChangePasswordSheet key={user.id} user={user} onClose={() => setSecurityOpen(false)} />
        )}

        {editOpen && (
          <EditProfileSheet
            visible
            userId={user.id}
            profile={profile as ProfileFields | null}
            isAgent={isAgentAccount}
            onSaved={refreshProfile}
            onClose={() => setEditOpen(false)}
          />
        )}

        <BottomSheet
          visible={signOutOpen}
          onClose={() => setSignOutOpen(false)}
          heightRatio={0.32}>
          <View style={styles.confirmBody}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="logout" size={22} color={colors.signOut} />
            </View>
            <Text style={styles.confirmTitle}>{t('common.signOut')}</Text>
            <Text style={styles.confirmText}>{t('common.confirmSignOut')}</Text>
            <PrimaryCTA
              label={t('common.signOut')}
              icon={null}
              onPress={() => {
                setSignOutOpen(false);
                signOut();
              }}
            />
            <GhostBtn label={t('common.cancel')} onPress={() => setSignOutOpen(false)} />
          </View>
        </BottomSheet>

        <BottomSheet
          visible={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          heightRatio={0.42}>
          <View style={styles.confirmBody}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="delete-forever" size={22} color={colors.signOut} />
            </View>
            <Text style={styles.confirmTitle}>{t('account.deleteAccount')}</Text>
            <Text style={styles.confirmText}>{t('account.deleteConfirmBody')}</Text>
            {deleteError && (
              <Text style={styles.deleteErrorText}>{t('account.deleteFailed')}</Text>
            )}
            <PrimaryCTA
              label={deleting ? t('common.loading') : t('account.deleteConfirmCta')}
              icon={null}
              onPress={handleDeleteAccount}
            />
            <GhostBtn
              label={t('common.cancel')}
              onPress={() => !deleting && setDeleteOpen(false)}
            />
          </View>
        </BottomSheet>
      </GradientBackground>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Web puts <DuskHero /> behind the signed-out auth screen — the dusk
          sky + lit skyline. The signed-in dashboard keeps GradientBackground,
          same split as web (DuskHero only renders on the auth branch). */}
      <DuskHero />
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Web shows its `.app-header` on every page including this one —
            wordmark, language, theme toggle. Mobile had only a bare floating
            language pill here, which is what stopped the two screens reading
            as the same product. `onDark` because this one sits over the
            DuskHero art in both themes. The account button web puts at the
            right is omitted: it navigates to /profile, which is this screen. */}
        <AppHeader onDark />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.authScrollContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.authHeroBlock}>
              <View style={styles.kickerRow}>
                <View style={styles.kickerDash} />
                <Text style={styles.kickerOnDark}>
                  {isSignUp ? t('auth.kickerSignUp') : t('auth.kickerSignIn')}
                </Text>
              </View>
              {/* Three stacked serif lines with the middle one in orange
                  italic — "Your / next door / is open." — at the prototype's
                  48px/0.98. Each line is its own <Text> rather than one
                  wrapping paragraph, so the break points are fixed by the
                  copy instead of by the device width. */}
              <View accessibilityRole="header">
                <Text style={styles.authHeadline}>
                  {isSignUp ? t('auth.heroSignUpPre') : t('auth.heroSignInPre')}
                </Text>
                <Text style={[styles.authHeadline, styles.authHeadlineEm]}>
                  {isSignUp ? t('auth.heroSignUpEm') : t('auth.heroSignInEm')}
                </Text>
                <Text style={styles.authHeadline}>
                  {isSignUp ? t('auth.heroSignUpPost') : t('auth.heroSignInPost')}
                </Text>
              </View>
            </View>

            <View style={styles.authGlass}>
              <View style={styles.roleToggle}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]}
                  onPress={() => setRole('buyer')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="person"
                    size={16}
                    color={role === 'buyer' ? '#fff' : 'rgba(255,255,255,0.5)'}
                  />
                  <Text style={[styles.roleBtnText, role === 'buyer' && styles.roleBtnTextActive]}>
                    {t('auth.roleClient')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.roleBtn, role === 'agent' && styles.roleBtnActive]}
                  onPress={() => setRole('agent')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="business-center"
                    size={16}
                    color={role === 'agent' ? '#fff' : 'rgba(255,255,255,0.5)'}
                  />
                  <Text style={[styles.roleBtnText, role === 'agent' && styles.roleBtnTextActive]}>
                    {t('auth.roleAgent')}
                  </Text>
                </TouchableOpacity>
              </View>

              {recoveryStep === 'email' ? (
                /* Password recovery, step A: which account. */
                <>
                  <Text style={styles.otpTitle} accessibilityRole="header">{t('auth.forgotTitle')}</Text>
                  <Text style={styles.otpSubtitle}>{t('auth.forgotSubtitle')}</Text>
                  <View style={styles.fieldRow}>
                    <MaterialIcons name="mail-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={t('auth.email')}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      accessibilityLabel={t('auth.email')}
                      onSubmitEditing={handleForgotPassword}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity accessibilityRole="button" onPress={handleForgotPassword} activeOpacity={0.85} disabled={resetSending}>
                    <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.ctaPill}>
                      <Text style={styles.ctaPillText}>{resetSending ? t('common.loading') : t('auth.sendCode')}</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" onPress={() => setRecoveryStep(null)} style={styles.linkButton}>
                    <Text style={styles.linkButtonText}>{t('auth.backToSignIn')}</Text>
                  </TouchableOpacity>
                </>
              ) : recoveryStep === 'code' ? (
                /* Password recovery, step 1: the 6-digit code from the
                   recovery e-mail. Verified as type 'recovery', which yields
                   a real session — no deep link needed. */
                <>
                  <Text style={styles.otpTitle}>{t('auth.enterCode')}</Text>
                  <Text style={styles.otpSubtitle}>{t('auth.codeSentTo', { email })}</Text>
                  <OtpInput
                    value={otpCode}
                    error={otpError}
                    editable={!otpVerifying}
                    onChange={(next) => {
                      setOtpCode(next);
                      if (otpError) setOtpError(false);
                    }}
                    onComplete={handleVerifyRecovery}
                  />
                  {otpVerifying && <Text style={styles.otpSubtitle}>{t('common.loading')}</Text>}
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={handleResendRecovery}
                    style={styles.linkButton}
                    disabled={cooldown > 0 || resetSending}>
                    <Text style={[styles.linkButtonText, cooldown > 0 && styles.linkButtonTextMuted]}>
                      {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" onPress={() => setRecoveryStep('email')} style={styles.linkButton}>
                    <Text style={styles.linkButtonText}>{t('common.back')}</Text>
                  </TouchableOpacity>
                </>
              ) : recoveryStep === 'password' ? (
                /* Password recovery, step 2: the recovery session is live, so
                   updateUser() is authorized to change the password. */
                <>
                  <Text style={styles.otpTitle}>{t('auth.recoveryTitle')}</Text>
                  <Text style={styles.otpSubtitle}>{t('auth.recoverySubtitle')}</Text>

                  <View style={styles.fieldRow}>
                    <MaterialIcons name="lock-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={t('auth.newPassword')}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      accessibilityLabel={t('auth.newPassword')}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.fieldEye}
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={18}
                        color="rgba(255,255,255,0.35)"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldRow}>
                    <MaterialIcons name="lock-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={t('auth.confirmPassword')}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry={!showPassword}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      accessibilityLabel={t('auth.confirmPassword')}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity accessibilityRole="button" onPress={handleSetNewPassword} activeOpacity={0.85} disabled={loading}>
                    <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.ctaPill}>
                      <Text style={styles.ctaPillText}>
                        {loading ? t('common.loading') : t('auth.updatePassword')}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                  {/* Leaving keeps the old password: signed in (the code did
                      that) if the recovery session is live, else the sign-in form. */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setRecoveryStep(null);
                    }}
                    style={styles.linkButton}
                    disabled={loading}>
                    <Text style={styles.linkButtonText}>{t('common.back')}</Text>
                  </TouchableOpacity>
                </>
              ) : otpStep ? (
                /* Email-code step — mirrors web's 'enter-code' otpStep: the
                   card swaps to code entry rather than navigating away, and
                   verification fires automatically once 6 digits land (web
                   does the same from handleOtpChange, no submit button). */
                <>
                  <Text style={styles.otpTitle}>{t('auth.enterCode')}</Text>
                  <Text style={styles.otpSubtitle}>{t('auth.codeSentTo', { email })}</Text>
                  <OtpInput
                    value={otpCode}
                    error={otpError}
                    editable={!otpVerifying}
                    onChange={(code) => {
                      setOtpCode(code);
                      if (otpError) setOtpError(false);
                    }}
                    onComplete={handleVerifyOtp}
                  />
                  {otpVerifying && <Text style={styles.otpSubtitle}>{t('common.loading')}</Text>}
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={handleResendOtp}
                    style={styles.linkButton}
                    disabled={cooldown > 0 || otpSending}>
                    <Text
                      style={[styles.linkButtonText, cooldown > 0 && styles.linkButtonTextMuted]}>
                      {cooldown > 0
                        ? t('auth.resendIn', { s: cooldown })
                        : t('auth.resendCode')}
                    </Text>
                  </TouchableOpacity>
                  {otpType === 'signup' && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => {
                        setOtpStep(false);
                        setIsSignUp(false);
                      }}
                      style={styles.linkButton}>
                      <Text style={styles.linkButtonText}>{t('auth.signupCodeHint')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity accessibilityRole="button" onPress={() => setOtpStep(false)} style={styles.linkButton}>
                    <Text style={styles.linkButtonText}>{t('common.back')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
              {isSignUp && (
                <View style={styles.fieldRow}>
                  <MaterialIcons name="person-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t('auth.fullName')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    textContentType="name"
                    autoComplete="name"
                    accessibilityLabel={t('auth.fullName')}
                  />
                </View>
              )}

              <View style={styles.fieldRow}>
                <MaterialIcons name="mail-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t('auth.email')}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType={isSignUp ? 'emailAddress' : 'username'}
                  autoComplete="email"
                  accessibilityLabel={t('auth.email')}
                />
              </View>

              <View style={styles.fieldRow}>
                <MaterialIcons name="lock-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t('auth.password')}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  accessibilityLabel={t('auth.password')}
                />
                <TouchableOpacity
                  style={styles.fieldEye}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    color="rgba(255,255,255,0.35)"
                  />
                </TouchableOpacity>
              </View>

              {isSignUp && (
                <View style={styles.fieldRow}>
                  <MaterialIcons name="lock-outline" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t('auth.confirmPassword')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    accessibilityLabel={t('auth.confirmPassword')}
                  />
                </View>
              )}

              {isSignUp && role === 'agent' && (
                <View style={styles.fieldRow}>
                  <MaterialIcons name="business" size={18} color="rgba(255,255,255,0.35)" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t('auth.agencyName')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={agencyName}
                    onChangeText={setAgencyName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Prototype's row above the CTA: what the selected role gets
                  you on the left, a compact "Forgot?" on the right. Sign-in
                  only — there's nothing to recover while creating an account,
                  and the prototype's sign-up screen omits it too. */}
              {!isSignUp && (
                <View style={styles.accessRow}>
                  <Text style={styles.accessText} numberOfLines={2}>
                    {role === 'agent' ? t('auth.accessAgent') : t('auth.accessClient')}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setRecoveryStep('email')}
                    hitSlop={8}>
                    <Text style={styles.accessForgot}>{t('auth.forgotShort')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity accessibilityRole="button" onPress={handleAuth} activeOpacity={0.85} disabled={loading}>
                <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.ctaPill}>
                  {/* Prototype CTA copy: "Step inside" on sign-in,
                      "Create account" on sign-up — not the bare verbs. */}
                  <Text style={styles.ctaPillText}>
                    {loading
                      ? t('common.loading')
                      : isSignUp
                        ? t('auth.createAccount')
                        : t('auth.stepInside')}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.signInWith')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Web's `.social-buttons` is a two-column grid (profile.css:192)
                  and the prototype's is the same 1fr 1fr pair — these were
                  stacked full-width here, which read as two primary actions
                  instead of one row of alternatives. */}
              <View style={styles.socialRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.socialButton}
                  onPress={() => handleProvider('google' as Provider)}
                  activeOpacity={0.8}
                  disabled={!!providerLoading}>
                  <GoogleLogo size={18} />
                  {/* Full label, allowed to wrap to a second line — that's
                      what web does in the same half-width cell. */}
                  <Text style={styles.socialLabel}>
                    {providerLoading === 'google' ? t('common.loading') : t('auth.continueWithGoogle')}
                  </Text>
                </TouchableOpacity>

                {/* Re-added per owner request 2026-08-18 (DECISIONS.md P2-G):
                    signInWithProvider/signInWithAppleNative already fully
                    support both. Supabase Dashboard still has both providers
                    toggled off as of this date (verified live).
                    What "fails" looks like differs by platform, verified live
                    on each rather than assumed:
                    - True native (iOS/Android): WebBrowser.openAuthSessionAsync
                      returns control to JS either way, so a disabled provider
                      surfaces as this screen's own friendly generic-error
                      Alert — friendlyAuthError's specific-message map doesn't
                      match this particular Error's wording, but the fallback
                      is still a localized message, never raw text.
                    - Expo running as a web target (Platform.OS === 'web'
                      branch) and the true Vite web app: identical rough edge
                      to each other — signInWithOAuth does a full-page
                      navigation to Supabase's /authorize endpoint rather than
                      a fetchable request, so a disabled provider's raw JSON
                      400 replaces the page before any app code runs. Not
                      fixable from in-app error handling; goes away once the
                      Dashboard config lands. */}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.socialButton}
                  onPress={() => handleProvider('apple' as Provider)}
                  activeOpacity={0.8}
                  disabled={!!providerLoading}>
                  <Ionicons name="logo-apple" size={19} color="#f5f0e8" />
                  <Text style={styles.socialLabel}>
                    {providerLoading === 'apple' ? t('common.loading') : t('auth.continueWithApple')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.socialButton}
                  onPress={() => handleProvider('linkedin_oidc' as Provider)}
                  activeOpacity={0.8}
                  disabled={!!providerLoading}>
                  <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                  <Text style={styles.socialLabel}>
                    {providerLoading === 'linkedin_oidc' ? t('common.loading') : t('auth.continueWithLinkedIn')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.socialButton}
                  onPress={handleSendOtp}
                  activeOpacity={0.8}
                  disabled={otpSending}>
                  {/* Was colors.textPrimary — near-black in the light theme,
                      which made the icon vanish against the dark glass card.
                      The card is dark in both themes, so this is fixed cream
                      like its own label. */}
                  <MaterialIcons name="mail-outline" size={18} color="#f5f0e8" />
                  <Text style={styles.socialLabel}>
                    {otpSending ? t('common.loading') : t('auth.signInWithEmail')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.linkButton}>
                <Text style={styles.linkButtonText}>
                  {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
                  <Text style={styles.linkButtonTextStrong}>
                    {isSignUp ? t('common.signIn') : t('common.signUp')}
                  </Text>
                </Text>
              </TouchableOpacity>

              {/* Reachable before signing up too: this is where people
                  decide whether to hand over their details. */}
              <View style={[styles.legalRow, styles.legalRowAuth]}>
                <Text style={[styles.legalLink, styles.legalLinkAuth]} accessibilityRole="link" onPress={() => openLegal('privacy')}>
                  {t('legal.privacyPolicy')}
                </Text>
                <Text style={[styles.legalDot, styles.legalLinkAuth]}>·</Text>
                <Text style={[styles.legalLink, styles.legalLinkAuth]} accessibilityRole="link" onPress={() => openLegal('terms')}>
                  {t('legal.termsOfService')}
                </Text>
              </View>
                </>
              )}
            </View>
          </ScrollView>
          <KeyboardDoneBar />
        </KeyboardAvoidingView>
      </SafeAreaView>

    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  flex: {
    flex: 1,
  },
  // 16 below the header's line, as on the other screens.
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  topBarTitle: {
    marginBottom: 12,
    fontFamily: Fonts?.serif,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // Matches web's .profile-card exactly.
  profileCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: Fonts?.serif,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileName: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accentGlow,
  },
  roleBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentText,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Matches web's .profile-stats exactly.
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statItemBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statValue: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },

  // Matches web's .profile-settings / .profile-row exactly.
  menuList: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Matches web's .profile-signout exactly.
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.signOut,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.signOut,
  },
  // Deliberately quieter than Sign out: a plain, unboxed text link at the very
  // bottom. Deleting an account is irreversible, so it should take intent to
  // find rather than sitting there as a second red button to mis-tap.
  deleteAccountButton: {
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  deleteAccountText: {
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  deleteErrorText: {
    fontSize: 13,
    color: colors.signOut,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  // 12px text; the vertical padding makes a ~34px tap row instead of 14px.
  legalLink: {
    paddingVertical: 10,
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 12,
    color: colors.textFaint,
  },
  // The signed-out card is dark glass in both themes, like linkButtonText.
  legalRowAuth: {
    paddingTop: 12,
    paddingBottom: 0,
  },
  legalLinkAuth: {
    color: 'rgba(255,255,255,0.5)',
  },

  // ─── Auth (signed-out) screen — matches web's .auth-screen family ───
  // Centered, not flex-end — pinning to the bottom with no hero illustration
  // above it (GradientBackground has no artwork) left a large empty block
  // at the top with nothing to justify it visually.
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 110,
  },
  authHeroBlock: {
    marginBottom: 20,
  },
  // Email-code step — mirrors web's .auth-title / .auth-subtitle inside the
  // otpStep card.
  otpTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  otpSubtitle: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },

  // Sign-out confirmation sheet.
  confirmBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  confirmIcon: {
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,53,69,0.12)',
  },
  confirmTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  confirmText: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  kickerDash: {
    width: 14,
    height: 1,
    backgroundColor: colors.accentLight,
  },
  kickerOnDark: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  // Prototype's hero: serif 48px / line-height 0.98 / letter-spacing -0.03em.
  authHeadline: {
    fontFamily: Fonts?.serif,
    fontSize: 48,
    lineHeight: 47,
    letterSpacing: -1.44,
    color: '#f5f0e8',
  },
  // The emphasised middle line — italic, --fho-orange-soft. These are static
  // per-weight font files, so the italic has to come from the italic family
  // rather than a fontStyle override on the upright one.
  authHeadlineEm: {
    fontFamily: Fonts?.serifItalic,
    color: colors.accentLight,
  },

  authGlass: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: 3,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  roleBtnActive: {
    backgroundColor: colors.accent,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  roleBtnTextActive: {
    color: '#fff',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    paddingLeft: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#f5f0e8',
    fontSize: 14,
  },
  fieldEye: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
  },
  ctaPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  // Prototype's role-context / "Forgot?" row: 12.5px, space-between, 4px
  // inset so it lines up with the fields rather than the card edge.
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  accessText: {
    // Shrinks so the longer translations (sq, ru) wrap instead of shoving
    // "Forgot?" off the card.
    flexShrink: 1,
    fontFamily: Fonts?.sans,
    fontSize: 12.5,
    color: 'rgba(255,235,210,0.7)',
  },
  accessForgot: {
    fontFamily: Fonts?.sansBold,
    fontSize: 12.5,
    color: colors.accentLight,
  },

  // Web's .social-buttons: `grid-template-columns: 1fr 1fr; gap: 8px`.
  // Web's `.social-buttons` is a CSS grid, 1fr 1fr — 4 buttons wrap into a
  // clean 2x2. `flex: 1` on the button doesn't wrap predictably, so this
  // uses a percentage width against a wrapping row instead, same effect.
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialButton: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  socialLabel: {
    // Shrinks and wraps inside the half-width cell instead of overflowing it.
    flexShrink: 1,
    fontFamily: Fonts?.sansMedium,
    fontSize: 13,
    color: '#f5f0e8',
  },
  linkButton: {
    alignItems: 'center',
    paddingTop: 4,
  },
  linkButtonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  linkButtonTextStrong: {
    color: colors.accentLight,
    fontWeight: '600',
  },
  // Resend link while the 30s lock is counting down.
  linkButtonTextMuted: {
    color: 'rgba(255,255,255,0.3)',
  },

});
