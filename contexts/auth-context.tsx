import { Provider } from '@supabase/supabase-js';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import Constants, { ExecutionEnvironment } from 'expo-constants';

import { signInWithAppleNative } from '@/lib/apple-auth';
import { supabase } from '@/lib/supabase';
// Same classifier the web AuthContext uses, imported rather than re-written:
// it is a pure function with no imports of its own, so it costs the mobile
// bundle nothing, and a mirrored copy would be free to drift. Mobile already
// reaches into src/ this way for the shared locale JSON (see i18n/index.ts).
// Its 8 unit tests in tests/authEvents.test.mjs now cover both apps.
import { classifyAuthEvent } from '../src/lib/authEvents.js';

/** If no auth event has arrived by now, stop blocking the splash screen. */
const AUTH_INIT_TIMEOUT_MS = 8000;

/**
 * True inside Expo Go (as opposed to a dev-client or store build).
 *
 * Expo Go owns the `exp://` scheme that Linking.createURL produces there, so
 * when Supabase redirects the OAuth callback back, iOS/Android hand it to Expo
 * Go's own generic "open a project" deep-link handler rather than routing it
 * to this app's pending openAuthSessionAsync promise. The promise therefore
 * never resolves with the code — confirmed on both platforms — and no amount
 * of app-side code can reclaim that scheme. A dev-client build owns
 * `shtepia-ime://` (app.json `scheme`, already registered in the Android
 * manifest) and does not have this problem.
 */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Dev-only OAuth tracing (Metro console). Never logs token/credential
// values — only the shape of what happened (redirect URI, whether a code
// came back, exchange success). Confirmed live: Supabase's /authorize
// endpoint 302s straight to Google for web, the native shtepia-ime://
// scheme, AND an exp://<lan-ip>:8081/--/... Expo Go URL alike — it does not
// reject an unrecognized redirect_to upfront. So a redirect failure, if
// that's the cause, only surfaces after Google hands control back to
// Supabase's own callback — a step this app can only observe from here,
// not simulate, hence this trace instead of a guessed fix.
function oauthDebug(label: string, data?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[oauth] ${label}`, data ?? '');
}

type Role = 'buyer' | 'agent';

interface SignUpOptions {
  role?: Role;
  full_name?: string;
  agency_name?: string;
}

interface Profile {
  id: string;
  role: string | null;
  full_name: string | null;
  agency_name: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAgent: boolean;
  isClient: boolean;
  refreshProfile: () => Promise<void>;
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
  /** Resolves with the sign-out error, if any. The local session is dropped
   *  regardless — callers may surface the error but must not block on it. */
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every auth event; an in-flight sync() only commits if it is
  // still the most recent when it resolves. Without this, a slow profile
  // fetch started by an earlier event can land *after* a later SIGNED_OUT
  // has cleared state and silently resurrect a signed-out user.
  //
  // A ref rather than an effect-local `let` so signOut() can invalidate
  // in-flight work too — it clears state synchronously, but a fetch already
  // running still matched the then-current generation and would commit over
  // the cleared state, re-showing the signed-out user until SIGNED_OUT
  // arrived. Mirrors web's AuthContext.
  const generation = useRef(0);

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return (data as Profile | null) ?? null;
  };

  // Mirrors web's AuthContext.applyPendingRole. OAuth and email-code signups
  // can't carry the role toggle through the provider/magic-link redirect, so
  // handle_new_user always defaults them to 'buyer' — profile.tsx stashes the
  // chosen role in AsyncStorage right before those two flows start (see
  // handleProvider/handleSendOtp), and this applies it once, only to an
  // account created moments ago. Signing in again later never rewrites an
  // existing role.
  const applyPendingRole = async (
    user: User,
    currentProfile: Profile | null,
  ): Promise<Profile | null> => {
    let pending: string | null = null;
    try {
      pending = await AsyncStorage.getItem('fho_pending_role');
      if (pending) await AsyncStorage.removeItem('fho_pending_role');
    } catch {
      return currentProfile;
    }
    if (pending !== 'agent' && pending !== 'buyer') return currentProfile;
    if (!currentProfile || currentProfile.role === pending) return currentProfile;
    const isNewAccount =
      !!user.created_at && Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000;
    if (!isNewAccount) return currentProfile;
    // Same narrowed SECURITY DEFINER RPC web uses (5-minute window,
    // agent<->buyer only) rather than a raw profiles UPDATE, which any
    // signed-in user could otherwise call on themselves to self-promote.
    const { data, error } = await supabase.rpc('claim_role', { new_role: pending });
    if (error) return currentProfile;
    return (data as Profile | null) ?? currentProfile;
  };

  useEffect(() => {
    let active = true;

    const sync = async (s: Session | null, myGeneration: number) => {
      if (!active || myGeneration !== generation.current) return;
      if (!s?.user) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      let p = await loadProfile(s.user.id);
      p = await applyPendingRole(s.user, p);
      if (!active || myGeneration !== generation.current) return;
      setSession(s);
      setProfile(p);
      setLoading(false);
    };

    // A single subscription drives both initial hydration and every later
    // event: supabase-js fires INITIAL_SESSION exactly once per subscriber
    // after its own startup work resolves. This previously *also* called
    // getSession() separately, so a cold start ran two concurrent profile
    // fetches racing each other — and, because applyPendingRole consumes the
    // one-shot `fho_pending_role` key, which of the two saw it was undefined.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      generation.current += 1;
      const myGeneration = generation.current;
      const decision = classifyAuthEvent(event, s);

      if (decision.action === 'clear') {
        setSession(null);
        setProfile(null);
        setLoading(false);
      } else if (decision.action === 'sync' || decision.action === 'sync-welcome') {
        // 'sync-welcome' is web's toast case; mobile has no welcome toast, so
        // both land here. TOKEN_REFRESHED with no session is a no-op, which
        // stops the hourly refresh from re-fetching the profile for nothing.
        sync(s, myGeneration);
      }
    });

    // Belt-and-braces for the case the removed getSession().catch() covered:
    // AppGate (app/_layout.tsx) holds the splash screen until `loading` is
    // false, so if INITIAL_SESSION never arrives — a wedged socket on a bad
    // connection — the app would sit behind the splash indefinitely. Degrade
    // to signed-out instead of hanging. Cleared as soon as any event lands.
    const initTimeout = setTimeout(() => {
      if (!active || generation.current > 0) return;
      console.warn('No auth event within %dms; continuing signed-out.', AUTH_INIT_TIMEOUT_MS);
      setLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    return () => {
      clearTimeout(initTimeout);
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!session?.user) return;
    const p = await loadProfile(session.user.id);
    setProfile(p);
  };

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

    // Stable across builds (Linking.createURL adapts automatically): a real
    // dev-client/production build gets the app.json `scheme` — shtepia-ime://
    // auth/callback — while Expo Go can't open that scheme back into itself,
    // so it substitutes its own LAN proxy address instead
    // (exp://<lan-ip>:8081/--/auth/callback), which changes whenever the
    // dev machine's IP does. Both need their own entry in Supabase's
    // Authentication → URL Configuration → Redirect URLs allow-list —
    // shtepia-ime://auth/callback for the former, and a wildcard host/port
    // (e.g. exp://*/--/auth/callback) for the latter, since the exact IP
    // can't be pinned in advance. This file can't read or write that
    // Dashboard config, so a rejection there is invisible to the app beyond
    // the browser session never completing — see oauthDebug below.
    const redirectTo = Linking.createURL('auth/callback');
    oauthDebug('starting', {
      platform: Platform.OS,
      provider,
      redirectTo,
      expoGo: IS_EXPO_GO,
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      oauthDebug('signInWithOAuth rejected before opening browser', { message: error.message });
      return { error: error as Error | null };
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
    );
    oauthDebug('browser session ended', { type: result.type });

    if (result.type !== 'success') {
      // In Expo Go this is not a user cancellation — the callback physically
      // cannot come back (see IS_EXPO_GO above), so the session always ends
      // this way even after a successful Google login. Saying so beats the
      // previous behaviour, where the browser closed and the screen simply
      // sat there with no explanation.
      if (IS_EXPO_GO) {
        return { error: new Error('EXPO_GO_OAUTH_UNSUPPORTED') };
      }
      // Outside Expo Go this is genuinely ambiguous from this API alone: a
      // real cancel and a Supabase callback rejecting an unlisted
      // redirect_to (its error page never matches our scheme, so the OS has
      // nothing to capture) look identical. Treated as a plain cancellation
      // — no alarming error for what is usually a real cancel — with the
      // trace above left for correlating against Supabase's Auth Logs.
      return { error: null };
    }

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    oauthDebug('callback received', { hasCode: !!code, oauthError, errorDescription });

    if (oauthError) {
      // Reuses friendlyAuthError's existing 'provider is not enabled' /
      // 'Unsupported provider' matches (profile.tsx) — no new copy needed.
      return { error: new Error(errorDescription || oauthError) };
    }

    if (!code) {
      return {
        error: new Error(
          'No authorization code received — check that the provider is enabled in Supabase Dashboard',
        ),
      };
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    oauthDebug('session exchange', { success: !exchangeError, message: exchangeError?.message });

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
    // Invalidate first: a profile fetch already in flight is now stale and
    // would otherwise still match the current generation and commit.
    generation.current += 1;
    const { error } = await supabase.auth.signOut();
    // This previously relied solely on the SIGNED_OUT event to clear state.
    // supabase-js drops the local session even when the server call fails
    // (an already-revoked token is the common case), so clearing here makes
    // sign-out synchronous rather than event-dependent — and surfaces the
    // error instead of discarding it, matching web.
    setSession(null);
    setProfile(null);
    setLoading(false);
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        isAgent: profile?.role === 'agent',
        isClient: profile?.role === 'client' || profile?.role === 'buyer',
        refreshProfile,
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
