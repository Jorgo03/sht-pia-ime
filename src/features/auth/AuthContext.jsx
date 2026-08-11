import { createContext, useContext, useEffect, useState } from 'react'
import i18n from '../../i18n/index.js'
import { supabase } from '../../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })
  const [welcomeName, setWelcomeName] = useState(null)

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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data
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

    const sync = async (session) => {
      if (!active) return
      if (!session?.user) {
        setState({ user: null, session: null, profile: null, loading: false })
        return
      }
      let profile = await loadProfile(session.user.id)
      profile = await applyPendingRole(session.user, profile)
      if (!active) return
      setState({ user: session.user, session, profile, loading: false })
      if (profile) loadPreferredLanguage(profile)
    }

    supabase.auth.getSession().then(({ data }) => sync(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          sync(session)
          showWelcome(session.user)
        } else if (event === 'TOKEN_REFRESHED' && session) {
          sync(session)
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, session: null, profile: null, loading: false })
        } else if (event === 'INITIAL_SESSION') {
          sync(session)
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
    return { error }
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

  const signOut = async () => {
    await supabase.auth.signOut()
    setState({ user: null, session: null, profile: null, loading: false })
  }

  const value = {
    user: state.user,
    session: state.session,
    profile: state.profile,
    loading: state.loading,
    isClient: state.profile?.role === 'client' || state.profile?.role === 'buyer',
    isAgent: state.profile?.role === 'agent',
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
