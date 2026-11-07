// The emailed 6-digit code that finishes a sign-up, shared by both apps (the
// phone app imports it through signupCode.d.ts). Pure, so `node --test`
// covers it without a bundler.
//
// Supabase Auth owns the code itself: it generates it, stores only a hash,
// expires it after the project's Email OTP expiry and deletes it on first
// use. What it does not do is tell a wrong code from an expired one (both
// come back as `otp_expired`, "Token has expired or is invalid"), cap wrong
// guesses per code (only per IP, the "token verifications" rate limit), or
// refuse a sign-up for an address that already has an account (it answers
// with a look-alike user so the address cannot be probed). This file covers
// those three on the client, without a second code system.

/** Seconds a code stays valid. Must equal supabase/config.toml's otp_expiry
 *  and the dashboard's Email OTP expiry; tests/authEmailTemplates checks the
 *  config and the templates against it. */
export const CODE_TTL_S = 600

/** Wrong codes allowed before the screen asks for a new one. */
export const MAX_CODE_ATTEMPTS = 5

/**
 * When the code just sent stops working, as epoch ms. Only for a code this
 * screen asked for itself: when one was sent earlier (a sign-in before
 * confirming, a "wait N seconds" refusal) the start is unknown, and the
 * caller keeps `null` rather than showing a countdown that may be wrong.
 */
export const codeExpiry = (now = Date.now()) => now + CODE_TTL_S * 1000

/** Whole seconds left, 0 once expired, null when the expiry is unknown. */
export function secondsLeft(expiresAt, now = Date.now()) {
  if (expiresAt == null) return null
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

/** 600 -> "10:00", 61 -> "1:01". */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const isRejectedCode = (error) =>
  error?.code === 'otp_expired' || /Token has expired or is invalid/i.test(error?.message ?? '')

/**
 * Whether a code should be sent to Supabase at all, as an i18n key saying why
 * not, or null to go ahead. An expired code or one past the attempt cap would
 * only be refused, and each refusal spends the per-IP verification budget.
 */
export function blockedCodeKey({ expiresAt, attempts, now = Date.now() }) {
  if (expiresAt != null && now >= expiresAt) return 'errors.codeExpired'
  if (attempts >= MAX_CODE_ATTEMPTS) return 'errors.codeAttempts'
  return null
}

/**
 * The message for a code Supabase refused, or null for any other error (the
 * caller falls back to authErrors.friendlyError). `attempts` counts this
 * refusal. With a known expiry the two cases can be told apart by the clock;
 * without one the shared "wrong or no longer valid" wording stays.
 */
export function rejectedCodeKey(error, { expiresAt, attempts, now = Date.now() }) {
  if (!isRejectedCode(error)) return null
  if (expiresAt != null && now >= expiresAt) return 'errors.codeExpired'
  if (attempts >= MAX_CODE_ATTEMPTS) return 'errors.codeAttempts'
  return expiresAt != null ? 'errors.codeIncorrect' : 'errors.invalidCode'
}

/**
 * signUp() for an address that already has a confirmed account returns no
 * error and a user with no identities, and sends no email (Supabase's
 * protection against probing which addresses are registered). Treated as
 * "account exists" so the person is sent to sign in, not left waiting for a
 * code that will never come. An unconfirmed earlier sign-up does get a new
 * code and keeps its identity, so it is not caught here.
 */
export function isExistingAccount(data) {
  const identities = data?.user?.identities
  return !data?.session && Array.isArray(identities) && identities.length === 0
}

/** The error both apps return for that case; authErrors maps the code. */
export function existingAccountError() {
  return Object.assign(new Error('User already registered'), { code: 'user_already_exists' })
}

/**
 * A session for an email-and-password account whose address was never
 * confirmed. With "Confirm email" on Supabase issues none, so this only
 * happens if the setting is off or a token was minted elsewhere; the apps
 * refuse it either way, so nothing behind sign-in opens for an unverified
 * address. Accounts from Google, Apple or LinkedIn are left alone: the
 * provider vouches for the address.
 */
export function isUnverifiedEmailUser(user) {
  if (!user) return false
  const provider = user.app_metadata?.provider ?? 'email'
  if (provider !== 'email') return false
  return !user.email_confirmed_at && !user.confirmed_at
}
