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
import { AtticoColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

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
          <Text style={styles.title}>{t('common.profile')}</Text>

          {user ? (
            <View style={styles.signedIn}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.user_metadata?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.email}>{user.email}</Text>
              {user.user_metadata?.full_name && (
                <Text style={styles.userName}>{user.user_metadata.full_name}</Text>
              )}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
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
              <Text style={styles.subtitle}>{t('auth.welcome')}</Text>
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

              <View style={styles.roleTabs}>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'buyer' && styles.roleTabActive]}
                  onPress={() => setRole('buyer')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={role === 'buyer' ? '#fff' : AtticoColors.textSecondary}
                  />
                  <Text
                    style={[styles.roleTabText, role === 'buyer' && styles.roleTabTextActive]}>
                    {t('auth.roleClient')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'agent' && styles.roleTabActive]}
                  onPress={() => setRole('agent')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="business-center"
                    size={18}
                    color={role === 'agent' ? '#fff' : AtticoColors.textSecondary}
                  />
                  <Text
                    style={[styles.roleTabText, role === 'agent' && styles.roleTabTextActive]}>
                    {t('auth.roleAgent')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formTitle}>
                {isSignUp ? t('auth.createAccount') : t('common.signIn')}
              </Text>
              <Text style={styles.formSubtitle}>
                {role === 'agent'
                  ? t('auth.agentSubtitle')
                  : t('auth.clientSubtitle')}
              </Text>

              {isSignUp && (
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.fullName')}
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor={AtticoColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                placeholderTextColor={AtticoColors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {isSignUp && role === 'agent' && (
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.agencyName')}
                  placeholderTextColor={AtticoColors.textSecondary}
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
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.signInWith')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                {socialProviders.map((sp) => (
                  <TouchableOpacity
                    key={sp.provider}
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin(sp.provider)}
                    activeOpacity={0.8}>
                    <Ionicons name={sp.ionicon} size={24} color={sp.color} />
                    <Text style={styles.socialLabel}>{sp.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.toggleButton}>
                <Text style={styles.toggleText}>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
    marginBottom: 24,
  },
  signedIn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AtticoColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: AtticoColors.textPrimary,
  },
  userName: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: AtticoColors.accent,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
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
    backgroundColor: AtticoColors.primaryLight,
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  roleTabActive: {
    backgroundColor: AtticoColors.accent,
  },
  roleTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
  },
  roleTabTextActive: {
    color: '#fff',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  input: {
    backgroundColor: AtticoColors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: AtticoColors.textPrimary,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AtticoColors.glassBorder,
  },
  dividerText: {
    fontSize: 13,
    color: AtticoColors.textSecondary,
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
    borderRadius: 16,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  socialLabel: {
    fontSize: 12,
    color: AtticoColors.textPrimary,
    fontWeight: '500',
  },
  toggleButton: {
    alignItems: 'center',
    paddingTop: 4,
  },
  toggleText: {
    fontSize: 14,
    color: AtticoColors.accent,
  },
});
