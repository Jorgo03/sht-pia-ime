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
//   on exactly the app's callback path. ngrok tunnels (*.exp.direct) are
//   refused on purpose: anyone can register one (owner decision 2026-10-26);
// - exp:// or exps:// to the owner's own Expo tunnel,
//   c-jorgo03-<id>-<id>.on.expo.app, no port, same path. The tunnel is
//   https, so Expo Go's own address for it is exps:// (seen in the auth logs
//   2026-11-07: accepting only exp:// sent that sign-in to the website). Those names are signed by Expo's server for one
//   account (@expo/cli AsyncWsTunnel -> createSignedTunnelUrlAsync); names
//   anyone can choose live on boltexpo.dev instead. An Android tester away
//   from the owner's Wi-Fi can only reach the app through it, and without it
//   Google sign-in ended on the website (2026-11-06, DECISIONS.md W3);
// - shtepia-ime://auth/callback, the dev-client and store builds' own scheme.
//
// The two inline copies in index.html and app/+html.tsx must give the same
// answers; tests/oauthRelay.test.mjs runs them against this one.

// Exactly the shape Expo signs for the account (c-<account>-<id>-<id>), so
// an account named "jorgo03-x" has one part too many and is refused.
const OWNER_TUNNEL = /^c-jorgo03-[a-z0-9]+-[a-z0-9]+\.on\.expo\.app$/

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
  if (u.protocol !== 'exp:' && u.protocol !== 'exps:') return false
  if (u.pathname !== '/--/auth/callback') return false
  if (!u.port && OWNER_TUNNEL.test(u.hostname)) return true
  return u.protocol === 'exp:' && isPrivateHost(u.hostname)
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

/**
 * Expo Go's own sign-in return address, built from the origin it loaded the
 * app's code from: http://192.168.0.8:8081 -> exp://192.168.0.8:8081/--/auth/callback,
 * https://<tunnel> -> exps://<tunnel>/--/auth/callback. null when there is no
 * usable origin.
 *
 * Not makeRedirectUri(): that trusts Constants.executionEnvironment, and on a
 * Samsung in Expo Go (SDK 58) that does not report Expo Go, so it answered
 * with the store build's shtepia-ime://auth/callback. Expo Go does not own
 * that scheme: the website relayed the code to an address nothing on the
 * phone answers and Google sign-in ended on the website (Supabase auth log
 * 2026-11-07 23:10 UTC). The origin is the address Expo Go really reached, so
 * it also holds behind a tunnel.
 */
export function expoGoCallback(bundleOrigin) {
  if (!bundleOrigin) return null
  let u
  try {
    u = new URL(bundleOrigin)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (!u.hostname || u.username || u.password) return null
  return `${u.protocol === 'https:' ? 'exps' : 'exp'}://${u.host}/--/auth/callback`
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
