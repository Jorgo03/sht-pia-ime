import { createContext, useContext, useEffect, useState } from 'react'
import i18n from '../i18n/index.js'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
      if (s?.user) loadPreferredLanguage(s.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) loadPreferredLanguage(s.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadPreferredLanguage = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single()
      if (data?.preferred_language && i18n.language !== data.preferred_language) {
        i18n.changeLanguage(data.preferred_language)
        localStorage.setItem('fho_lang', data.preferred_language)
      }
    } catch {}
  }

  const signUp = async (email, password, options = {}) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: options.role ?? 'buyer',
          full_name: options.full_name,
          agency_name: options.agency_name,
        },
      },
    })
    return { error }
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInWithProvider = async (provider, role = 'buyer') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        queryParams: { role },
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
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signUp,
        signIn,
        signInWithProvider,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
