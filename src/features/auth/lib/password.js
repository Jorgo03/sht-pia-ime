// Password rules and the signed-in password change, shared by both apps (the
// phone app imports this through password.d.ts). Pure apart from the Supabase
// client the caller passes in, so tests run it against a fake server.

export const PASSWORD_MIN_LENGTH = 8
// bcrypt, which Supabase Auth hashes passwords with, reads only the first 72
// bytes: anything after them would silently not count.
export const PASSWORD_MAX_BYTES = 72

function utf8Length(s) {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
  }
  return n
}

/** Error key for a password someone is choosing, or null when it is allowed. */
export function passwordStrengthError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return 'errors.passwordMin'
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return 'errors.passwordTooLong'
  return null
}

/** Error key for a new password and its confirmation, or null. */
export function newPasswordError(password, confirm, { current } = {}) {
  const weak = passwordStrengthError(password)
  if (weak) return weak
  if (current != null && password === current) return 'errors.passwordSame'
  if (password !== confirm) return 'errors.passwordMismatch'
  return null
}

const PROVIDER_LABELS = { google: 'Google', apple: 'Apple', linkedin_oidc: 'LinkedIn', azure: 'Microsoft' }

/** How this account signs in: 'email' plus the OAuth providers linked to it. */
export function signInMethods(user) {
  const fromIdentities = (user?.identities ?? []).map((i) => i?.provider)
  const meta = user?.app_metadata ?? {}
  const fromMetadata = Array.isArray(meta.providers) ? meta.providers : [meta.provider]
  return [...new Set([...fromIdentities, ...fromMetadata].filter(Boolean))]
}

/**
 * True when the account can have a password of its own. An account that only
 * ever signed in with Google or Apple has none: its password is the
 * provider's, so a "current password" form would be a dead end.
 * Unknown (no identities reported) counts as email, the way it signed up.
 */
export function hasPasswordSignIn(user) {
  const methods = signInMethods(user)
  return methods.length === 0 || methods.includes('email')
}

/** Display names of the OAuth providers on the account, e.g. "Google". */
export function providerLabels(user) {
  return signInMethods(user)
    .filter((m) => m !== 'email')
    .map((m) => PROVIDER_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1))
}

/**
 * Changes the signed-in person's password after checking the current one.
 *
 * updateUser({ password }) does not ask for the old password: on a project
 * without "Secure password change", any live session may set a new one. So
 * the current password is checked first by signing in with it, which also
 * gives the change a fresh session, the condition Supabase's "Secure password
 * change" setting enforces on the server. Other sessions are then signed out,
 * so a lost or shared device does not stay in the account.
 *
 * Resolves to { status: 'changed', othersSignedOut } | { status: 'wrongCurrent' }
 * | { status: 'failed', error }. Never throws, never stores either password.
 */
export async function changePassword(client, { email, currentPassword, newPassword }) {
  try {
    const { error: checkError } = await client.auth.signInWithPassword({ email, password: currentPassword })
    if (checkError) {
      const wrong = checkError.code === 'invalid_credentials' || /Invalid login credentials/.test(checkError.message ?? '')
      return wrong ? { status: 'wrongCurrent' } : { status: 'failed', error: checkError }
    }
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) return { status: 'failed', error }
    return { status: 'changed', othersSignedOut: await signOutOtherDevices(client) }
  } catch (error) {
    return { status: 'failed', error }
  }
}

/** Best effort: true when every other session of the account was ended. */
export async function signOutOtherDevices(client) {
  try {
    const { error } = await client.auth.signOut({ scope: 'others' })
    return !error
  } catch {
    return false
  }
}
