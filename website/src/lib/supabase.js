import { createClient } from '@supabase/supabase-js'

// The website's one client. Sessions are kept in this browser so a signed-in
// person stays signed in; the Google sign-in return lands on the site and is
// read from the address.
const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.EXPO_PUBLIC_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing Supabase env vars (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY) at build time.')
}

/** localStorage, or memory when the browser blocks it (the session then ends with the tab). */
function safeStorage() {
  try {
    const probe = '__fho_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    const mem = new Map()
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  }
}

export const storage = safeStorage()

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage },
})
