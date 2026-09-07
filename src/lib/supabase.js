import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fails loudly and by name rather than letting an undefined value reach
// createClient(), where it surfaces as an opaque error from inside supabase-js.
// The deployment half of the message matters: Vite inlines these at BUILD time,
// so setting them on the host after a build has already shipped changes
// nothing — the bundle has to be rebuilt. A deploy missing them produces a
// bundle that throws right here, which is one of the two ways this app used to
// render a blank page (index.html's boot guard now renders this text instead).
if (!url || !key) {
  throw new Error(
    'Missing Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
      'Set both in .env.local for local development, or in the hosting provider\'s ' +
      'environment settings and then redeploy — Vite inlines them at build time, ' +
      'so a build made without them can never pick them up at runtime.',
  )
}

/**
 * localStorage, or an in-memory stand-in when the browser refuses it.
 *
 * `window.localStorage` is not a safe expression to evaluate. A browser that
 * blocks site data — Safari in some private-browsing configurations, Chrome
 * with third-party cookies blocked when the page is embedded, or an enterprise
 * policy — throws a SecurityError on *access*, before any read or write. That
 * happened at module scope, which put it ahead of ReactDOM.createRoot() in
 * main.jsx, so <ErrorBoundary> was never mounted to catch it and the visitor
 * got a blank page instead of a marketplace.
 *
 * The probe writes as well as reads: some browsers hand back a localStorage
 * object whose quota is zero, so only setItem reveals the problem.
 *
 * Degrading costs one thing — the session is not persisted, so the visitor is
 * signed out when the tab closes. That is plainly better than the site failing
 * to load, and it matches what the Expo client (lib/supabase.ts) already does
 * for the same reason.
 */
function resolveAuthStorage() {
  try {
    const probe = '__fho_storage_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    const memory = new Map()
    return {
      getItem: (name) => (memory.has(name) ? memory.get(name) : null),
      setItem: (name, value) => {
        memory.set(name, String(value))
      },
      removeItem: (name) => {
        memory.delete(name)
      },
    }
  }
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: resolveAuthStorage(),
    flowType: 'pkce',
  },
  global: { headers: { 'x-client-info': 'shtepia.ime/web' } },
})
