import { Provider } from '@supabase/supabase-js';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Dismisses a lingering auth session left over from a previous attempt (a
// reload mid-flow, a backgrounded browser). Documented as required for
// expo-auth-session flows; a no-op when there is nothing pending.
WebBrowser.maybeCompleteAuthSession();
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

// Dev-only OAuth diagnostics (Metro console), on failure paths only — the
// happy path is silent. Never logs token/credential values, only the shape
// of what failed.
//
// Kept rather than deleted because of what was confirmed live: Supabase's
// /authorize endpoint 302s straight to Google for web, the native
// shtepia-ime:// scheme, AND an exp://<lan-ip>:8081/--/... Expo Go URL
// alike — it does not reject an unrecognized redirect_to upfront. A bad
// redirect therefore surfaces only after Google hands control back, as a
// silent 'cancel' indistinguishable from the user closing the browser.
// Without these the next such failure is invisible.
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
    /**
     * `needsConfirmation` is false when Supabase returned a session, i.e. the
     * project has "Confirm email" off and the account is already signed in —
     * the caller must NOT send that user to the code-entry screen.
     */
  ) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
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
  /** Verifies the 6-digit code from the recovery e-mail, establishing a
   *  recovery session so the password can be changed in-app. */
  verifyRecoveryCode: (email: string, token: string) => Promise<{ error: Error | null }>;
  /** Sets a new password on the active (recovery) session. */
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
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
    const { data, error } = await supabase.auth.signUp({
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
    // Whether the caller must collect a confirmation code, decided by what
    // Supabase actually returned rather than assumed. With "Confirm email" ON
    // there is a user but no session and a code arrives by email; with it OFF
    // there is a session and no mail is ever sent. Sending everyone to the
    // code screen strands an already-signed-in user on a dead end.
    // Mirrors src/features/auth/AuthContext.jsx.
    return {
      error: error as Error | null,
      needsConfirmation: !error && !data?.session,
    };
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

    // makeRedirectUri() rather than Linking.createURL(): it is the API
    // expo-auth-session builds its own flows on, and it resolves per
    // environment without the caller choosing — Expo Go gets
    // exp://<lan-host>/--/auth/callback, a dev-client or store build gets the
    // app.json scheme (shtepia-ime://auth/callback). One call, three
    // environments, and the web branch above never reaches here.
    //
    // Whatever it returns must be present in Supabase's
    // Authentication → URL Configuration → Redirect URLs. If it is not,
    // Supabase refuses the redirect_to *after* Google has already
    // authenticated the user and sends the browser to its own error page
    // instead — an https URL that can never match this scheme, so the auth
    // session ends with no callback. That failure is indistinguishable from
    // a user cancelling, which is exactly why the exact value is logged
    // below rather than guessed at.
    const appRedirect = makeRedirectUri({ path: 'auth/callback' });

    // Expo Go's address cannot be allow-listed. Verified against the live
    // project by binding a redirect_to to an OAuth state and replaying the
    // callback: exp://<host>:<port>/--/auth/callback is refused, and so is a
    // broad `exp://**`, while shtepia-ime://auth/callback is honored. So the
    // scheme itself is fine — Supabase's matcher will not accept a host:port
    // authority on a non-http scheme.
    //
    // The web callback IS allow-listed, and Supabase preserves extra query
    // parameters through the redirect (also verified). So under Expo Go the
    // OAuth result is routed through the web callback, which forwards it to
    // this app — see relayToNativeApp in src/features/auth/pages/AuthCallback.jsx,
    // where the permitted target schemes are constrained to prevent an open
    // redirect leaking the authorization code.
    //
    // A dev-client or store build owns shtepia-ime:// and is allow-listed
    // directly, so it skips the relay entirely — the detour is Expo Go's
    // problem alone and disappears with it.
    const webOrigin = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'https://real-estate-app-hazel-seven.vercel.app';
    const redirectTo = IS_EXPO_GO
      ? `${webOrigin}/auth/callback?rt=${encodeURIComponent(appRedirect)}`
      : appRedirect;

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

    // Second argument is appRedirect, NOT redirectTo: it tells the auth
    // session which URL ends the flow, and that is always this app's own
    // address. Under the relay, redirectTo is an https page the browser
    // merely passes through on its way here — waiting for that instead would
    // end the session one hop early, before the code reached the app.
    const result = await WebBrowser.openAuthSessionAsync(data.url, appRedirect);

    if (result.type !== 'success') {
      // 'cancel' means the auth session closed without a URL matching
      // appRedirect. Two very different causes produce it: the user dismissed
      // the browser, or Supabase rejected redirectTo and sent the browser
      // somewhere this scheme can never match. The API cannot tell them
      // apart, so this returns no error (a real cancel must not look like a
      // failure) and logs the two redirect URIs instead — if redirectTo is
      // absent from the Supabase allow-list, that is the cause.
      oauthDebug('auth session closed without reaching the app', {
        type: result.type,
        appRedirect,
        redirectTo,
        viaRelay: IS_EXPO_GO,
      });
      return { error: null };
    }

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (oauthError) {
      // Reuses friendlyAuthError's existing 'provider is not enabled' /
      // 'Unsupported provider' matches (profile.tsx) — no new copy needed.
      return { error: new Error(errorDescription || oauthError) };
    }

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        oauthDebug('session exchange (pkce) failed', { message: exchangeError.message });
      }
      return { error: exchangeError as Error | null };
    }

    // Not assuming PKCE: this client sets flowType 'pkce', so a `?code=` is
    // expected — but if the instance ever answers with the implicit flow the
    // tokens arrive in the URL *fragment*, which searchParams cannot see.
    // Handling both means a change in Supabase's response shape degrades to a
    // working sign-in rather than a silent "no code received".
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (setErr) {
        oauthDebug('session set (implicit) failed', { message: setErr.message });
      }
      return { error: setErr as Error | null };
    }

    oauthDebug('callback carried neither code nor tokens', {
      hasQuery: url.search.length > 1,
      hasFragment: url.hash.length > 1,
    });
    return {
      error: new Error(
        'No authorization code received — check that the provider is enabled in Supabase Dashboard',
      ),
    };
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

  /**
   * Completes password recovery without leaving the app.
   *
   * The recovery e-mail carries a 6-digit code as well as a link, so mobile
   * does not need a deep link at all: verifying the code with type
   * 'recovery' establishes a real session, and updateUser then changes the
   * password on that session's authority.
   *
   * This replaces sending mobile users to the web app to finish — a genuine
   * dead end for anyone who only has the app installed.
   */
  const verifyRecoveryCode = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    return { error: error as Error | null };
  };

  /** Only meaningful while a recovery session is active — that session is what
   *  authorizes the change, exactly as on web. */
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
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
        verifyRecoveryCode,
        updatePassword,
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
