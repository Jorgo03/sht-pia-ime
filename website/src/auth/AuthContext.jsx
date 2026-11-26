import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, storage } from '../lib/supabase'
import { existingAccountError, isExistingAccount, isUnverifiedEmailUser } from '@/src/features/auth/lib/signupCode.js'
import { createLoginThrottle, isWrongPassword, THROTTLE_STORAGE_KEY, tooManyAttemptsError } from '@/src/features/auth/lib/loginThrottle.js'
import { oauthQueryParams } from '@/src/features/auth/lib/oauthOptions.js'
import { isLanguage } from '../../../i18n/languages.js'

// Sign-in for the website, on the same accounts as the phone app and with the
// same rules (contexts/auth-context.tsx): the same sign-up metadata the
// handle_new_user trigger reads, the same password-guessing throttle, and an
// unconfirmed email address opens nothing.

const AuthContext = createContext(null)

const throttle = createLoginThrottle({
  load: () => storage.getItem(THROTTLE_STORAGE_KEY),
  save: (raw) => storage.setItem(THROTTLE_STORAGE_KEY, raw),
})

const PROFILE_COLUMNS = 'id, full_name, role, agency_name, phone, avatar_url'

async function loadProfile(id) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const apply = async (s) => {
      if (s?.user && isUnverifiedEmailUser(s.user)) {
        // Dropped locally, as in the app: the person is still mid sign-up.
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        s = null
      }
      if (!alive) return
      setSession(s)
      if (!s) {
        setProfile(null)
        setReady(true)
        return
      }
      try {
        const p = await loadProfile(s.user.id)
        if (alive) setProfile(p)
      } catch {
        // Signed in even when the profile cannot be read right now.
      }
      if (alive) setReady(true)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes do not change who is signed in.
      if (event === 'TOKEN_REFRESHED') return setSession(s)
      // Deferred: supabase-js holds a lock during this callback.
      setTimeout(() => apply(s), 0)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const gate = throttle.check(email)
    if (!gate.allowed) return { error: tooManyAttemptsError(gate.waitMs) }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (isWrongPassword(error)) throttle.fail(email)
    else if (!error) throttle.succeed(email)
    return { error }
  }, [])

  // role is 'buyer' or 'agent', as in the app; an agent's office name is
  // required by the form and stored as agency_name by the signup trigger.
  const signUp = useCallback(async ({ email, password, role, fullName, agencyName, language }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: signupData({ role, fullName, agencyName, language }) },
    })
    if (!error && isExistingAccount(data)) return { error: existingAccountError(), needsConfirmation: false }
    return { error, needsConfirmation: !error && !data?.session }
  }, [])

  const verifyCode = useCallback(async (email, token, type) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type })
    return { error }
  }, [])

  const resendSignupCode = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error }
  }, [])

  const sendResetCode = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }, [])

  // The app's "Email code": a 6-digit code instead of a password. On the
  // sign-up form it also carries the chosen role and names, so a new account
  // starts as what the person picked.
  const sendEmailCode = useCallback(async (email, profile) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: profile ? { data: signupData(profile) } : undefined,
    })
    return { error }
  }, [])

  const signInWithProvider = useCallback(async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/account`, queryParams: oauthQueryParams(provider) },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    setProfile(await loadProfile(session.user.id))
  }, [session])

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, profile, ready, signIn, signUp, verifyCode, resendSignupCode, sendResetCode, updatePassword, sendEmailCode, signInWithProvider, signOut, refreshProfile }),
    [session, profile, ready, signIn, signUp, verifyCode, resendSignupCode, sendResetCode, updatePassword, sendEmailCode, signInWithProvider, signOut, refreshProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** What the handle_new_user trigger reads from a new account's metadata. */
function signupData({ role, fullName, agencyName, language }) {
  return {
    role: role === 'agent' ? 'agent' : 'buyer',
    full_name: fullName || undefined,
    agency_name: role === 'agent' ? agencyName || undefined : undefined,
    preferred_language: isLanguage(language) ? language : undefined,
  }
}
