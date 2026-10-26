// Mobile sign-in relay: which app addresses may receive a sign-in code
// (index.html, app/+html.tsx, AuthCallback.jsx, app/auth/callback.web.tsx).
// Pure, for `npm test`.
//
// Under Expo Go the phone's own callback (exp://<host>:<port>/--/auth/callback)
// cannot be allow-listed in Supabase, so Google returns to the website's
// /auth/callback?rt=<that address>&code=… and the page hands the code on. A
// relay that forwards to any address it is given is an account takeover: an
// attacker starts a sign-in with their own PKCE verifier and rt pointing at a
// server of theirs, sends the link, and receives the victim's code. So only:
// - exp:// to this device or a private network (home Wi-Fi, a phone hotspot),
//   on exactly the app's callback path. Expo tunnels (*.exp.direct) are
//   refused on purpose: anyone can register one (owner decision 2026-10-26);
// - shtepia-ime://auth/callback, the dev-client and store builds' own scheme.
//
// The two inline copies in index.html and app/+html.tsx must give the same
// answers; tests/oauthRelay.test.mjs runs them against this one.

function isPrivateHost(h) {
  if (h === 'localhost' || h === '[::1]') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const p = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  for (let i = 0; i < 4; i++) if (p[i] > 255) return false
  return p[0] === 10 || p[0] === 127 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
}

/** True for a URL object this site may hand a sign-in code to. */
export function isAppCallback(u) {
  if (!u || u.username || u.password) return false
  if (u.protocol === 'shtepia-ime:') return u.hostname === 'auth' && u.pathname === '/callback'
  if (u.protocol !== 'exp:') return false
  return u.pathname === '/--/auth/callback' && isPrivateHost(u.hostname)
}

/**
 * The app address to forward this callback to, with Supabase's parameters
 * (code, or error/error_description) and fragment carried over; null when the
 * callback is not for the app or the address is not allowed.
 */
export function buildRelayTarget(search, hash) {
  const params = new URLSearchParams(search)
  const target = params.get('rt')
  if (!target) return null
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return null
  }
  if (!isAppCallback(parsed)) return null
  params.delete('rt')
  params.forEach((value, key) => parsed.searchParams.set(key, value))
  if (hash && hash.length > 1) parsed.hash = hash
  return parsed.toString()
}

/** A kept target (window.__FHO_RELAY_TARGET__) is trusted only if it still passes. */
export function isAllowedRelayTarget(url) {
  if (typeof url !== 'string') return false
  try {
    return isAppCallback(new URL(url))
  } catch {
    return false
  }
}
