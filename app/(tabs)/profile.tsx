import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Provider } from '@supabase/supabase-js';
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
  { provider: 'yahoo' as Provider, label: 'Yahoo', ionicon: 'logo-yahoo', color: '#6001D2' },
];

export default function ProfileScreen() {
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
      Alert.alert('Error', 'Please fill in email and password.');
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
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Check your email to confirm your account.');
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleSocialLogin = async (provider: Provider) => {
    const { error } = await signInWithProvider(provider);
    if (error) {
      Alert.alert('Error', error.message);
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
          <Text style={styles.title}>Profile</Text>

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
                  {user.user_metadata?.role === 'agent' ? 'Agent' : 'User'}
                </Text>
              </View>
              <Text style={styles.subtitle}>Welcome to Shtëpia.ime</Text>
              <View style={styles.signOutWrap}>
                <ActionButton
                  title="Sign Out"
                  variant="secondary"
                  onPress={() => signOut()}
                />
              </View>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.form}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

              {/* Role Tabs */}
              <View style={styles.roleTabs}>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'buyer' && styles.roleTabActive]}
                  onPress={() => setRole('buyer')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={role === 'buyer' ? AtticoColors.primary : AtticoColors.textSecondary}
                  />
                  <Text
                    style={[styles.roleTabText, role === 'buyer' && styles.roleTabTextActive]}>
                    User
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'agent' && styles.roleTabActive]}
                  onPress={() => setRole('agent')}
                  activeOpacity={0.7}>
                  <MaterialIcons
                    name="business-center"
                    size={18}
                    color={role === 'agent' ? AtticoColors.primary : AtticoColors.textSecondary}
                  />
                  <Text
                    style={[styles.roleTabText, role === 'agent' && styles.roleTabTextActive]}>
                    Agent
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formTitle}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
              <Text style={styles.formSubtitle}>
                {role === 'agent'
                  ? 'List and manage your properties'
                  : 'Find your perfect home'}
              </Text>

              {isSignUp && (
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={AtticoColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={AtticoColors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {isSignUp && role === 'agent' && (
                <TextInput
                  style={styles.input}
                  placeholder="Agency Name"
                  placeholderTextColor={AtticoColors.textSecondary}
                  value={agencyName}
                  onChangeText={setAgencyName}
                  autoCapitalize="words"
                />
              )}

              <ActionButton
                title={
                  loading
                    ? 'Loading...'
                    : isSignUp
                      ? 'Sign Up'
                      : 'Sign In'
                }
                onPress={handleAuth}
              />

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Login Buttons */}
              <View style={styles.socialRow}>
                {socialProviders.map((sp) => (
                  <TouchableOpacity
                    key={sp.provider}
                    style={[styles.socialButton, { backgroundColor: sp.color }]}
                    onPress={() => handleSocialLogin(sp.provider)}
                    activeOpacity={0.8}>
                    <Ionicons name={sp.ionicon} size={24} color="#fff" />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Social labels */}
              <View style={styles.socialRow}>
                {socialProviders.map((sp) => (
                  <Text key={sp.provider} style={styles.socialLabel}>
                    {sp.label}
                  </Text>
                ))}
              </View>

              {/* Toggle Sign In / Sign Up */}
              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.toggleButton}>
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
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
    backgroundColor: AtticoColors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: AtticoColors.primary,
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
    backgroundColor: AtticoColors.accentLight,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: AtticoColors.primary,
  },
  subtitle: {
    fontSize: 14,
    color: AtticoColors.textSecondary,
    marginTop: 4,
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
    backgroundColor: AtticoColors.accentLight,
  },
  roleTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
  },
  roleTabTextActive: {
    color: AtticoColors.primary,
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    fontSize: 13,
    color: AtticoColors.textSecondary,
    paddingHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  socialLabel: {
    fontSize: 11,
    color: AtticoColors.textSecondary,
    width: 52,
    textAlign: 'center',
  },
  toggleButton: {
    alignItems: 'center',
    paddingTop: 4,
  },
  toggleText: {
    fontSize: 14,
    color: AtticoColors.accentLight,
  },
});
