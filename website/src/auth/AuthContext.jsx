import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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

// Where a Google or LinkedIn sign-in should land: the provider always returns
// to /account (the address on the Supabase allow-list), so the page the person
// came from is kept here for one return trip.
const OAUTH_NEXT_KEY = 'fho_oauth_next'
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : null)

function takeOAuthNext() {
  try {
    const next = safePath(sessionStorage.getItem(OAUTH_NEXT_KEY))
    sessionStorage.removeItem(OAUTH_NEXT_KEY)
    return next
  } catch {
    return null
  }
}

const PROFILE_COLUMNS = 'id, full_name, role, agency_name, phone, avatar_url'

async function loadProfile(id) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // The user object stays the same while the same person is signed in, so
  // pages keyed on it do not refetch on every token refresh or tab refocus.
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)
  const uidRef = useRef(null)

  useEffect(() => {
    let alive = true
    const apply = async (s) => {
      if (s?.user && isUnverifiedEmailUser(s.user)) {
        // Dropped locally, as in the app: the person is still mid sign-up.
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        s = null
      }
      if (!alive) return
      const uid = s?.user?.id ?? null
      const switched = uid !== uidRef.current
      uidRef.current = uid
      setSession(s)
      setUser((prev) => (prev && s?.user && prev.id === s.user.id && prev.updated_at === s.user.updated_at ? prev : s?.user ?? null))
      if (!s) {
        setProfile(null)
        setReady(true)
        return
      }
      // Another account: never show the previous person's profile or role.
      if (switched) setProfile(null)
      try {
        const p = await loadProfile(s.user.id)
        if (alive && uidRef.current === uid) setProfile(p)
      } catch {
        // Signed in even when the profile cannot be read right now.
      }
      if (!alive) return
      setReady(true)
      // Back from Google or LinkedIn: go on to the page the person came from.
      if (switched && window.location.pathname === '/account') {
        const next = takeOAuthNext()
        if (next && next !== '/account') window.location.replace(next)
      }
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes, and the SIGNED_IN supabase-js repeats when a tab
      // regains focus, do not change who is signed in.
      if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && s?.user?.id && s.user.id === uidRef.current)) {
        setSession(s)
        setUser((prev) => (prev && prev.id === s?.user?.id && prev.updated_at === s?.user?.updated_at ? prev : s?.user ?? null))
        return
      }
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

  const signInWithProvider = useCallback(async (provider, next) => {
    try {
      const path = safePath(next)
      if (path && path !== '/account') sessionStorage.setItem(OAUTH_NEXT_KEY, path)
      else sessionStorage.removeItem(OAUTH_NEXT_KEY)
    } catch {
      // Storage blocked: the person lands on their account instead.
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/account`, queryParams: oauthQueryParams(provider) },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    uidRef.current = null
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    setProfile(await loadProfile(user.id))
  }, [user])

  const value = useMemo(
    () => ({ session, user, profile, ready, signIn, signUp, verifyCode, resendSignupCode, sendResetCode, updatePassword, sendEmailCode, signInWithProvider, signOut, refreshProfile }),
    [session, user, profile, ready, signIn, signUp, verifyCode, resendSignupCode, sendResetCode, updatePassword, sendEmailCode, signInWithProvider, signOut, refreshProfile],
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
