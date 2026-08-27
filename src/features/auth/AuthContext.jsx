import { createContext, useContext, useEffect, useRef, useState } from 'react'
import i18n from '../../i18n/index.js'
import { supabase } from '../../lib/supabase'
import { classifyAuthEvent } from '../../lib/authEvents'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })
  const [welcomeName, setWelcomeName] = useState(null)
  // True from the moment a password-recovery link's session lands until
  // updatePassword() succeeds. While true, the UI shows the new-password
  // form instead of the ordinary signed-in dashboard, even though the
  // recovery session is itself a real, valid session.
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // Bumped on every auth event; an in-flight sync() only commits its result
  // if it's still the most recent one when it resolves. Without this, a slow
  // profile fetch started by an old event (e.g. the initial SIGNED_IN
  // restore) can resolve *after* a subsequent SIGNED_OUT has already cleared
  // state, and silently resurrect a signed-out user.
  //
  // A ref rather than an effect-local `let` specifically so signOut() can
  // invalidate in-flight work too: it clears state synchronously, but a
  // profile fetch already in flight still matched the then-current
  // generation and would commit on top of the cleared state, re-showing the
  // signed-out user until SIGNED_OUT arrived and cleared it a second time.
  const generation = useRef(0)

  const showWelcome = (user) => {
    if (!user) return
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      null
    if (name) setWelcomeName(name)
  }

  const loadProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return data ?? null
    } catch {
      // A thrown exception here (network failure, not an RLS/API-level
      // error, which already resolves to data:null without throwing) must
      // never take the whole session down with it — the user stays
      // authenticated with profile:null rather than stuck loading forever.
      return null
    }
  }

  // OAuth signups can't carry the role toggle through the provider redirect,
  // so handle_new_user defaults them to client. Profile.jsx stashes the
  // chosen role before redirecting; apply it here — once, and only to an
  // account created moments ago. Signing in again never rewrites a role.
  const applyPendingRole = async (user, profile) => {
    let pending = null
    try {
      pending = localStorage.getItem('fho_pending_role')
      if (pending) localStorage.removeItem('fho_pending_role')
    } catch { return profile }
    if (pending !== 'agent' && pending !== 'buyer') return profile
    if (!profile || profile.role === pending) return profile
    const isNewAccount = user.created_at && Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000
    if (!isNewAccount) return profile
    // OAuth can't carry the role picked before the provider redirect, so this
    // is the one legitimate client-side role write — narrowed to a
    // SECURITY DEFINER RPC (5-minute window, agent<->buyer only) rather than
    // a raw column UPDATE, which any signed-in user could otherwise call on
    // themselves to self-promote to agent.
    const { data, error } = await supabase.rpc('claim_role', { new_role: pending })
    if (error) return profile
    return data || profile
  }

  const loadPreferredLanguage = (profile) => {
    const lang = profile?.preferred_language
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang)
      localStorage.setItem('fho_lang', lang)
    }
  }

  useEffect(() => {
    let active = true

    const sync = async (session, myGeneration) => {
      if (!active || myGeneration !== generation.current) return
      if (!session?.user) {
        setState({ user: null, session: null, profile: null, loading: false })
        return
      }
      let profile = await loadProfile(session.user.id)
      profile = await applyPendingRole(session.user, profile)
      if (!active || myGeneration !== generation.current) return
      setState({ user: session.user, session, profile, loading: false })
      if (profile) loadPreferredLanguage(profile)
    }

    // A single subscription drives both the initial-load hydration and
    // every later event. supabase-js guarantees INITIAL_SESSION fires
    // exactly once per subscriber right after the client's own startup
    // work resolves — calling supabase.auth.getSession() separately here
    // as well (as this used to) duplicated that same profile fetch on
    // every cold load for no benefit.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        generation.current += 1
        const myGeneration = generation.current
        const decision = classifyAuthEvent(event, session)

        if ('passwordRecovery' in decision) setPasswordRecovery(decision.passwordRecovery)

        if (decision.action === 'clear') {
          setState({ user: null, session: null, profile: null, loading: false })
        } else if (decision.action === 'sync' || decision.action === 'sync-welcome') {
          sync(session, myGeneration)
          if (decision.action === 'sync-welcome') {
            // Only a genuine OAuth sign-in sets this flag right before the
            // redirect (password/OTP call showWelcome directly on success
            // instead) — a restored session replaying SIGNED_IN on page
            // load never has it set, so it's a no-op there.
            try {
              if (sessionStorage.getItem('fho_pending_welcome')) {
                sessionStorage.removeItem('fho_pending_welcome')
                showWelcome(session.user)
              }
            } catch { /* ignore */ }
          }
        }
      },
    )

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const refreshProfile = async () => {
    if (!state.user) return
    const profile = await loadProfile(state.user.id)
    setState((s) => ({ ...s, profile }))
    if (profile) loadPreferredLanguage(profile)
  }

  const signUp = async (email, password, options = {}) => {
    // Email flows set the role via metadata — a stale OAuth stash must not
    // apply on top of them.
    try { localStorage.removeItem('fho_pending_role') } catch { /* ignore */ }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: options.role ?? 'buyer',
          full_name: options.full_name,
          agency_name: options.agency_name,
          preferred_language: i18n.language,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // The handle_new_user trigger persists role/agency_name from the metadata
    // above — role is NOT repeated here, since authenticated no longer holds
    // UPDATE on that column (see restrict_profile_role_writes migration) and
    // including it would fail this entire statement, silently dropping the
    // full_name/agency_name update too. This only runs when a session already
    // exists (email confirmation disabled) and is kept as a safety net for
    // those two fields.
    if (!error && data?.user && data?.session) {
      await supabase
        .from('profiles')
        .update({
          full_name: options.full_name || null,
          agency_name: options.role === 'agent' ? (options.agency_name || null) : null,
        })
        .eq('id', data.user.id)
    }
    // Whether the caller must collect a confirmation code, decided by what
    // Supabase actually returned rather than assumed.
    //
    // With "Confirm email" ON, signUp returns a user and NO session, and the
    // 6-digit code arrives by email. With it OFF, signUp returns a session and
    // the user is already signed in — there is no code and no email will ever
    // arrive. The form used to send everyone to the code screen regardless,
    // which strands a successfully registered, already-signed-in user on a
    // dead end. That setting is a dashboard toggle the app cannot see, so the
    // session is the only reliable signal.
    return { error, needsConfirmation: !error && !data?.session }
  }

  const signIn = async (email, password) => {
    try { localStorage.removeItem('fho_pending_role') } catch { /* ignore */ }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data?.user) showWelcome(data.user)
    return { error }
  }

  const sendOtp = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Lets the emailed magic LINK log the user in directly (same
      // browser/device) via our callback — typing the code stays as the
      // cross-device fallback.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error }
  }

  // type: 'email' for codes requested via signInWithOtp (the "Email Code"
  // flow); 'signup' for the confirmation code a password signup receives.
  const verifyOtp = async (email, token, type = 'email') => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })
    if (!error && data?.user) showWelcome(data.user)
    return { data, error }
  }

  // Resend the right kind of code for the flow that's waiting on it.
  const resendCode = async (email, type = 'email') => {
    if (type === 'signup') {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      return { error }
    }
    return sendOtp(email)
  }

  const signInWithProvider = async (provider) => {
    try { sessionStorage.setItem('fho_pending_welcome', '1') } catch { /* ignore */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Deliberately NO extra queryParams. access_type=offline +
        // prompt=consent forced Google's legacy consent screen on every
        // sign-in, which is prone to hanging on a blank page — and the
        // Google refresh token it grants is unused (Supabase manages its
        // own session; the app never calls Google APIs directly).
      },
    })
    return { error }
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    })
    return { error }
  }

  // Completes the recovery flow the PASSWORD_RECOVERY branch above started.
  // Only meaningful while passwordRecovery is true — the recovery link's own
  // session is what authorizes this updateUser() call, same as any other
  // authenticated request.
  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setPasswordRecovery(false)
    return { error }
  }

  const signOut = async () => {
    // Invalidate first: any profile fetch already in flight is now stale, and
    // without this bump it would still match the current generation and
    // commit on top of the cleared state below.
    generation.current += 1
    const { error } = await supabase.auth.signOut()
    // supabase-js clears the local session even when the server call fails
    // (an expired/already-revoked token is the common case), and the
    // SIGNED_OUT event still fires — so the user is signed out locally
    // regardless. Clearing here as well keeps it synchronous rather than
    // waiting on the event, and the error is surfaced instead of swallowed.
    setState({ user: null, session: null, profile: null, loading: false })
    setPasswordRecovery(false)
    return { error }
  }

  const value = {
    user: state.user,
    session: state.session,
    profile: state.profile,
    loading: state.loading,
    isClient: state.profile?.role === 'client' || state.profile?.role === 'buyer',
    isAgent: state.profile?.role === 'agent',
    passwordRecovery,
    updatePassword,
    welcomeName,
    clearWelcome: () => setWelcomeName(null),
    signUp,
    signIn,
    sendOtp,
    verifyOtp,
    resendCode,
    signInWithProvider,
    signOut,
    resetPassword,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
