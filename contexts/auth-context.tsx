import { Provider } from '@supabase/supabase-js';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { signInWithAppleNative } from '@/lib/apple-auth';
import { supabase } from '@/lib/supabase';

type Role = 'buyer' | 'agent';

interface SignUpOptions {
  role?: Role;
  full_name?: string;
  agency_name?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    options?: SignUpOptions,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithProvider: (provider: Provider) => Promise<{ error: Error | null }>;
  /** Email-code (OTP) sign-in, same flow as web's AuthContext.sendOtp. */
  sendOtp: (email: string) => Promise<{ error: Error | null }>;
  /** `type` mirrors web: 'email' for a code from sendOtp, 'signup' for the
   *  confirmation code a password signup receives. */
  verifyOtp: (
    email: string,
    token: string,
    type?: 'email' | 'signup',
  ) => Promise<{ error: Error | null }>;
  /** Re-issues the code behind the resend link. Must be given the same `type`
   *  the code originally came from, or Supabase rejects the verify that
   *  follows. */
  resendCode: (
    email: string,
    type?: 'email' | 'signup',
  ) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
      })
      .catch((err) => {
        // getSession() can reject on a genuine network failure (it may hit
        // the network to refresh an expired token) — on a bad connection
        // that's not a hypothetical. Without this catch, `loading` would
        // never flip to false and the app would sit behind the splash
        // screen forever, since AppGate (app/_layout.tsx) now waits on it.
        // Degrade to signed-out rather than hang.
        console.error('Session restore failed, continuing signed-out:', err);
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    options?: SignUpOptions,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: options?.role ?? 'buyer',
          full_name: options?.full_name,
          agency_name: options?.agency_name,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithProvider = async (provider: Provider) => {
    if (provider === 'apple' && Platform.OS === 'ios') {
      return signInWithAppleNative();
    }

    if (Platform.OS === 'web') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: origin },
      });
      return { error: error as Error | null };
    }

    const redirectTo = Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { error: error as Error | null };

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
    );

    if (result.type !== 'success') {
      return { error: new Error('Authentication was cancelled or the provider is not configured') };
    }

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const errorDescription = url.searchParams.get('error_description');

    if (!code) {
      return {
        error: new Error(
          errorDescription ?? 'No authorization code received — check that the provider is enabled in Supabase Dashboard',
        ),
      };
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    return { error: exchangeError as Error | null };
  };

  // Mirrors web's AuthContext.sendOtp/verifyOtp so the email-code flow behaves
  // identically on both platforms. On native the emailed magic *link* can't
  // hand a session back to the app the way it does in a browser, so the
  // 6-digit code is the path here — hence no emailRedirectTo.
  const sendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error as Error | null };
  };

  const verifyOtp = async (
    email: string,
    token: string,
    type: 'email' | 'signup' = 'email',
  ) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type });
    return { error: error as Error | null };
  };

  // Mirrors web's AuthContext.resendCode: a signup confirmation code goes
  // through auth.resend(), while an OTP code is just another signInWithOtp.
  const resendCode = async (email: string, type: 'email' | 'signup' = 'email') => {
    if (type === 'signup') {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      return { error: error as Error | null };
    }
    return sendOtp(email);
  };

  // Web passes `redirectTo: <origin>/profile`. Native deliberately doesn't:
  // the recovery link has to open a screen that can set a new password, and
  // this app has no such screen (nor a registered deep link for one). Omitting
  // redirectTo makes Supabase fall back to the project's Site URL — the web
  // app — so the reset completes there and the new password works here.
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signUp,
        signIn,
        signInWithProvider,
        sendOtp,
        verifyOtp,
        resendCode,
        resetPassword,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
