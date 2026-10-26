// What Supabase Auth puts in the address of a page an email link (or a
// provider) lands on. Pure, so the pages and the tests share one reading.
// Nothing here ever returns a URL to go to: the pages only navigate to fixed
// routes of their own, so no link parameter can redirect anyone elsewhere.

/** Types a link to /auth/confirm may carry (see supabase/templates). */
export const EMAIL_LINK_TYPES = ['email', 'signup', 'magiclink', 'invite', 'recovery', 'email_change']

// GoTrue's token hashes are hex digests, "pkce_"-prefixed for PKCE flows.
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,256}$/

function parts(href) {
  try {
    const url = new URL(href)
    return { query: url.searchParams, hash: new URLSearchParams(url.hash.replace(/^#/, '')) }
  } catch {
    return { query: new URLSearchParams(), hash: new URLSearchParams() }
  }
}

/** The token_hash link an email template sends, or null when this is not one. */
export function emailLinkFrom(href) {
  const { query } = parts(href)
  const tokenHash = query.get('token_hash')
  const type = query.get('type')
  if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash) || !EMAIL_LINK_TYPES.includes(type)) return null
  return { tokenHash, type }
}

/** Supabase's error report in a redirect (query or fragment), or null. */
export function authRedirectError(href) {
  const { query, hash } = parts(href)
  const pick = (k) => query.get(k) ?? hash.get(k)
  const error = pick('error')
  const code = pick('error_code')
  const description = pick('error_description')
  if (!error && !code && !description) return null
  return { error, code, description }
}

/** True when the address carries an authorization code (?code=). */
export function hasAuthCode(href) {
  return parts(href).query.has('code')
}

const EXPIRED = ['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier']

/** Message key for a link that did not work, from a redirect or a verify error. */
export function linkErrorKey(err) {
  if (EXPIRED.includes(err?.code)) return 'errors.linkExpired'
  // A used or expired email link comes back as access_denied + otp_expired;
  // access_denied alone is a refused sign-in at the provider.
  if (err?.error === 'access_denied' && !err?.code) return 'errors.oauthFailed'
  return 'errors.linkInvalid'
}

let providerSettings = null

/**
 * Whether Supabase has this sign-in provider switched on, from Auth's public
 * /settings (the same answer for every visitor). Resolves to null when that
 * cannot be read, so callers carry on as before rather than block sign-in.
 *
 * Needed because a provider switched off in the dashboard (Apple and LinkedIn
 * as of 2026-10-26) replaced the website with Supabase's raw JSON error page:
 * signInWithOAuth navigates away before any app code can catch the refusal.
 */
export function providerEnabled(client, provider) {
  providerSettings ??= fetch(`${client.auth.url}/settings`, { headers: client.auth.headers })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
  return providerSettings.then((settings) => {
    const on = settings?.external?.[provider]
    if (typeof on !== 'boolean') providerSettings = null
    return typeof on === 'boolean' ? on : null
  })
}
