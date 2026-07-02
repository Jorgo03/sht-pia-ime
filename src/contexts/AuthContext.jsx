import { createContext, useContext, useEffect, useState } from 'react'
import i18n from '../i18n/index.js'
import { supabase } from '../lib/supabase'

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
      const profile = await loadProfile(session.user.id)
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: options.role ?? 'client',
          full_name: options.full_name,
          agency_name: options.agency_name,
          preferred_language: i18n.language,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // The handle_new_user trigger persists role/agency_name from the metadata
    // above. This update only succeeds when a session already exists (email
    // confirmation disabled) and is kept as a safety net.
    if (!error && data?.user && data?.session) {
      await supabase
        .from('profiles')
        .update({
          role: options.role ?? 'client',
          full_name: options.full_name || null,
          agency_name: options.role === 'agent' ? (options.agency_name || null) : null,
        })
        .eq('id', data.user.id)
    }
    return { error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data?.user) showWelcome(data.user)
    return { error }
  }

  const sendOtp = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error }
  }

  const verifyOtp = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (!error && data?.user) showWelcome(data.user)
    return { data, error }
  }

  const signInWithProvider = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
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
