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

// The owner's rule (2026-11-18): an uppercase letter, a lowercase letter, a
// number and a special character. The classes are the ones Supabase checks
// with "Password requirements: lowercase, uppercase letters, digits and
// symbols", so the app never accepts what the server would refuse: a-z and
// A-Z only (ë or Ç do not count as letters there), and this symbol set.
const SYMBOLS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~"

/** Which of the five requirements a password meets, for the live checklist. */
export function passwordChecks(password) {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: [...password].some((ch) => SYMBOLS.includes(ch)),
  }
}

/** Error key for a password someone is choosing, or null when it is allowed.
 *  Only for choosing one: sign-in never applies it, so older passwords that
 *  predate the rule still work. */
export function passwordStrengthError(password) {
  const checks = passwordChecks(password)
  if (!checks.length) return 'errors.passwordMin'
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return 'errors.passwordTooLong'
  if (!checks.upper) return 'errors.passwordUpper'
  if (!checks.lower) return 'errors.passwordLower'
  if (!checks.digit) return 'errors.passwordDigit'
  if (!checks.symbol) return 'errors.passwordSymbol'
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
