import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Provider } from '@supabase/supabase-js';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { useTheme } from '@/contexts/theme-context';
import { useTabBarClearance } from '@/components/liquid-tab-bar';
import { AppHeader } from '@/components/ui/app-header';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { DuskHero } from '@/components/ui/dusk-hero';
import { GoogleLogo } from '@/components/ui/google-logo';
import { GradientBackground } from '@/components/ui/gradient-background';
import { OtpInput, OTP_LENGTH } from '@/components/ui/otp-input';
import { useProfileStats } from '@/hooks/use-profile-stats';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

type Role = 'buyer' | 'agent';

/** Seconds the resend link stays locked after a code goes out — same 30 web uses. */
const RESEND_COOLDOWN_S = 30;

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    user,
    signIn,
    signUp,
    signOut,
    signInWithProvider,
    sendOtp,
    verifyOtp,
    resendCode,
    resetPassword,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<Role>('buyer');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Email-code (OTP) flow — web's equivalent lives in Profile.jsx's
  // handleGoogleOtp/otpStep state.
  const [otpSending, setOtpSending] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  // Reddens the six boxes together after a rejected code, cleared on the next
  // keystroke — same signal web gives via `.otp-digit.error`.
  const [otpError, setOtpError] = useState(false);
  // Seconds left on the resend lock. Web starts this at 30 on every send so a
  // user can't hammer the endpoint into a Supabase rate-limit.
  const [cooldown, setCooldown] = useState(0);
  const [resetSending, setResetSending] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Resend cooldown ticker. Guarded on `cooldown > 0` rather than `cooldown`
  // so it schedules one interval for the whole countdown instead of tearing
  // down and re-creating a timer every second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown > 0]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('errors.fillFields'));
      return;
    }
    setLoading(true);
    if (isSignUp) {
      const { error } = await signUp(email, password, {
        role,
        full_name: fullName || undefined,
        agency_name: role === 'agent' ? agencyName || undefined : undefined,
      });
      setLoading(false);
      if (error) {
        Alert.alert(t('common.error'), error.message);
      } else {
        Alert.alert('OK', t('auth.checkEmail'));
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        Alert.alert(t('common.error'), error.message);
      }
    }
  };

  // Google is the only social provider currently enabled in the Supabase
  // dashboard — matches web's own Profile.jsx, which dropped Apple/LinkedIn
  // for the same reason (DECISIONS.md P2-G) rather than ship dead buttons.
  // Mirrors web's handleGoogleOtp: needs the email field filled first, then
  // swaps the form to code entry rather than navigating away.
  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.enterEmail'));
      return;
    }
    setOtpSending(true);
    const { error } = await sendOtp(email);
    setOtpSending(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
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
    setOtpSending(true);
    const { error } = await resendCode(email, 'email');
    setOtpSending(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    setCooldown(RESEND_COOLDOWN_S);
  };

  // Takes the code as an argument rather than reading `otpCode` — the
  // auto-verify fires from inside onChangeText, before that state update has
  // flushed, so the state value would still be 5 digits here.
  const handleVerifyOtp = async (code: string) => {
    if (code.length < OTP_LENGTH) return;
    setOtpVerifying(true);
    const { error } = await verifyOtp(email, code, 'email');
    setOtpVerifying(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      setOtpCode('');
      setOtpError(true);
      return;
    }
    // A successful verify puts a session in place; AuthProvider's
    // onAuthStateChange swaps this screen to the signed-in dashboard.
    setOtpStep(false);
  };

  // Mirrors web's handleForgotPassword. The emailed link lands on the web app
  // (see resetPassword in auth-context) — there's no in-app recovery screen —
  // so the copy stays "check your email", which is true on both platforms.
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.enterEmail'));
      return;
    }
    setResetSending(true);
    const { error } = await resetPassword(email);
    setResetSending(false);
    Alert.alert(
      error ? t('common.error') : t('auth.checkEmail'),
      error ? error.message : t('auth.resetSent'),
    );
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithProvider('google' as Provider);
    setGoogleLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (authLoading) return null;

  if (user) {
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '?';
    const initial = (displayName[0] ?? '?').toUpperCase();
    const isAgent = user.user_metadata?.role === 'agent';

    return (
      <GradientBackground>
        <SafeAreaView style={styles.flex} edges={['top']}>
          {/* The signed-in dashboard used to carry its own title row with a
              duplicate theme toggle and language pill — the shared header
              provides both, so this screen now matches web's layout instead
              of running a parallel one. */}
          <AppHeader />
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.topBarTitle}>{t('common.profile')}</Text>

            {/* Matches web's .profile-card exactly. */}
            <View style={styles.profileCard}>
              <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{isAgent ? t('auth.agent') : t('auth.user')}</Text>
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
                  {isAgent ? t('profile.statListings') : t('profile.statViewings')}
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
                style={styles.menuRow}
                onPress={() => router.push('/viewings' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="calendar-today" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('viewings.kicker')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => router.push('/my-listings' as Href)}
                activeOpacity={0.7}>
                <MaterialIcons name="home-work" size={20} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>{t('listing.myListings')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {isAgent && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => router.push('/agent-dashboard' as Href)}
                    activeOpacity={0.7}>
                    <MaterialIcons name="bar-chart" size={20} color={colors.textPrimary} />
                    <Text style={styles.menuRowText}>{t('agentDashboard.kicker')}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Signing out is one tap from a scroll — easy to hit by accident,
                and it costs the user their session. Confirm first. */}
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => setSignOutOpen(true)}
              activeOpacity={0.8}>
              <MaterialIcons name="logout" size={18} color="#dc3545" />
              <Text style={styles.signOutText}>{t('common.signOut')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>

        <BottomSheet
          visible={signOutOpen}
          onClose={() => setSignOutOpen(false)}
          heightRatio={0.32}>
          <View style={styles.confirmBody}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="logout" size={22} color="#dc3545" />
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
              <View>
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

              {otpStep ? (
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
                  <TouchableOpacity onPress={() => setOtpStep(false)} style={styles.linkButton}>
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
                  keyboardType="email-address"
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
                />
                <TouchableOpacity style={styles.fieldEye} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    color="rgba(255,255,255,0.35)"
                  />
                </TouchableOpacity>
              </View>

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
                    onPress={handleForgotPassword}
                    disabled={resetSending}
                    hitSlop={8}>
                    <Text style={styles.accessForgot}>
                      {resetSending ? t('common.loading') : t('auth.forgotShort')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity onPress={handleAuth} activeOpacity={0.85} disabled={loading}>
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
                  style={styles.socialButton}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.8}
                  disabled={googleLoading}>
                  <GoogleLogo size={18} />
                  {/* Full label, allowed to wrap to a second line — that's
                      what web does in the same half-width cell. */}
                  <Text style={styles.socialLabel}>
                    {googleLoading ? t('common.loading') : t('auth.continueWithGoogle')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
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
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.linkButton}>
                <Text style={styles.linkButtonText}>
                  {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
                  <Text style={styles.linkButtonTextStrong}>
                    {isSignUp ? t('common.signIn') : t('common.signUp')}
                  </Text>
                </Text>
              </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  topBarTitle: {
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
    color: colors.accentEnd,
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
    borderColor: '#dc3545',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#dc3545',
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
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialButton: {
    flex: 1,
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
