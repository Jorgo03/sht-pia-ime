import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Provider } from '@supabase/supabase-js';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
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

import { ActionButton } from '@/components/ui/action-button';
import { GradientBackground } from '@/components/ui/gradient-background';
import { useAuth } from '@/contexts/auth-context';
import { useFhoTheme } from '@/hooks/use-fho-theme';

type Role = 'buyer' | 'agent';

const socialProviders: {
  provider: Provider;
  label: string;
  ionicon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { provider: 'google', label: 'Google', ionicon: 'logo-google', color: '#EA4335' },
  { provider: 'apple', label: 'Apple', ionicon: 'logo-apple', color: '#000000' },
  { provider: 'linkedin_oidc', label: 'LinkedIn', ionicon: 'logo-linkedin', color: '#0A66C2' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, radii, fonts, theme, toggle } = useFhoTheme();
  const { user, signIn, signUp, signOut, signInWithProvider, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<Role>('buyer');
  const [loading, setLoading] = useState(false);

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

  const handleSocialLogin = async (provider: Provider) => {
    const { error } = await signInWithProvider(provider);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (authLoading) return null;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontFamily: fonts.serif, color: colors.text }]}>
              {t('common.profile')}
            </Text>
            <TouchableOpacity
              style={[
                styles.themeToggle,
                { borderRadius: radii.pill, backgroundColor: colors.surface2, borderColor: colors.borderStrong },
              ]}
              onPress={toggle}
              accessibilityLabel={t('common.toggleTheme')}
              hitSlop={8}>
              <MaterialIcons
                name={theme === 'dark' ? 'light-mode' : 'dark-mode'}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {user ? (
            <View style={styles.signedIn}>
              <View style={[styles.avatar, { borderRadius: radii.pill, backgroundColor: colors.orange1 }]}>
                <Text style={[styles.avatarText, { fontFamily: fonts.serifSemiBold }]}>
                  {(user.user_metadata?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.email, { fontFamily: fonts.sansSemiBold, color: colors.text }]}>
                {user.email}
              </Text>
              {user.user_metadata?.full_name && (
                <Text style={[styles.userName, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                  {user.user_metadata.full_name}
                </Text>
              )}
              <View style={[styles.roleBadge, { borderRadius: radii.pill, backgroundColor: colors.orangeTint }]}>
                <Text style={[styles.roleBadgeText, { fontFamily: fonts.sansBold, color: colors.orange1 }]}>
                  {user.user_metadata?.role === 'agent' ? t('auth.agent') : t('auth.user')}
                </Text>
              </View>
              {user.user_metadata?.role === 'agent' && (
                <View style={styles.agentActions}>
                  <ActionButton
                    title={t('listing.newListing')}
                    onPress={() => router.push('/listing/create' as Href)}
                  />
                </View>
              )}
              <Text style={[styles.subtitle, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                {t('auth.welcome')}
              </Text>
              <View style={styles.signOutWrap}>
                <ActionButton
                  title={t('common.signOut')}
                  variant="secondary"
                  onPress={() => signOut()}
                />
              </View>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.form}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

              <View style={[styles.roleTabs, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}>
                <TouchableOpacity
                  style={[
                    styles.roleTab,
                    { borderRadius: radii.md },
                    role === 'buyer' && { backgroundColor: colors.orange1 },
                  ]}
                  onPress={() => setRole('buyer')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={role === 'buyer' ? '#fff' : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.roleTabText,
                      { fontFamily: fonts.sansSemiBold, color: role === 'buyer' ? '#fff' : colors.textMuted },
                    ]}>
                    {t('auth.roleClient')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleTab,
                    { borderRadius: radii.md },
                    role === 'agent' && { backgroundColor: colors.orange1 },
                  ]}
                  onPress={() => setRole('agent')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="business-center"
                    size={18}
                    color={role === 'agent' ? '#fff' : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.roleTabText,
                      { fontFamily: fonts.sansSemiBold, color: role === 'agent' ? '#fff' : colors.textMuted },
                    ]}>
                    {t('auth.roleAgent')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.formTitle, { fontFamily: fonts.serif, color: colors.text }]}>
                {isSignUp ? t('auth.createAccount') : t('common.signIn')}
              </Text>
              <Text style={[styles.formSubtitle, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                {role === 'agent'
                  ? t('auth.agentSubtitle')
                  : t('auth.clientSubtitle')}
              </Text>

              {isSignUp && (
                <TextInput
                  style={[styles.input, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text, fontFamily: fonts.sans }]}
                  placeholder={t('auth.fullName')}
                  placeholderTextColor={colors.textFaint}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={[styles.input, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text, fontFamily: fonts.sans }]}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.textFaint}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text, fontFamily: fonts.sans }]}
                placeholder={t('auth.password')}
                placeholderTextColor={colors.textFaint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {isSignUp && role === 'agent' && (
                <TextInput
                  style={[styles.input, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text, fontFamily: fonts.sans }]}
                  placeholder={t('auth.agencyName')}
                  placeholderTextColor={colors.textFaint}
                  value={agencyName}
                  onChangeText={setAgencyName}
                  autoCapitalize="words"
                />
              )}

              <ActionButton
                title={
                  loading
                    ? t('common.loading')
                    : isSignUp
                      ? t('common.signUp')
                      : t('common.signIn')
                }
                onPress={handleAuth}
              />

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { fontFamily: fonts.sans, color: colors.textMuted }]}>
                  {t('auth.signInWith')}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.socialRow}>
                {socialProviders.map((sp) => (
                  <TouchableOpacity
                    key={sp.provider}
                    style={[styles.socialButton, { borderRadius: radii.lg, backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}
                    onPress={() => handleSocialLogin(sp.provider)}
                    activeOpacity={0.8}>
                    <Ionicons name={sp.ionicon} size={24} color={sp.color} />
                    <Text style={[styles.socialLabel, { fontFamily: fonts.sansMedium, color: colors.text }]}>
                      {sp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.toggleButton}>
                <Text style={[styles.toggleText, { fontFamily: fonts.sansSemiBold, color: colors.orange1 }]}>
                  {isSignUp
                    ? `${t('auth.hasAccount')} ${t('common.signIn')}`
                    : `${t('auth.noAccount')} ${t('common.signUp')}`}
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    letterSpacing: -0.5,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signedIn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
  },
  email: {
    fontSize: 16,
  },
  userName: {
    fontSize: 14,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  agentActions: {
    marginTop: 16,
    width: '100%',
  },
  signOutWrap: {
    marginTop: 32,
    width: '100%',
  },
  form: {
    flex: 1,
    gap: 14,
  },
  roleTabs: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  roleTabText: {
    fontSize: 15,
  },
  formTitle: {
    fontSize: 24,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    paddingHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  socialLabel: {
    fontSize: 12,
  },
  toggleButton: {
    alignItems: 'center',
    paddingTop: 4,
  },
  toggleText: {
    fontSize: 14,
  },
});
