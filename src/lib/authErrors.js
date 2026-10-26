// Pure auth-form helpers, split out of Profile.jsx so they're testable
// without a JSX/CSS-aware loader (this repo's `npm test` is plain
// `node --test`, no bundler). `t` is passed in rather than imported so this
// stays decoupled from react-i18next — callers pass their own useTranslation() `t`.
// Both apps use it; the phone app imports it through authErrors.d.ts.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supabase Auth's error codes (error.code in auth-js 2.x). Checked before the
// message text below: the codes are a stable API, the English text is not.
const CODE_KEYS = {
  invalid_credentials: 'errors.invalidCredentials',
  email_not_confirmed: 'errors.emailNotConfirmed',
  user_already_exists: 'errors.userExists',
  email_exists: 'errors.userExists',
  email_address_invalid: 'errors.invalidEmail',
  otp_expired: 'errors.invalidCode',
  same_password: 'errors.passwordSame',
  over_request_rate_limit: 'errors.rateLimited',
  over_email_send_rate_limit: 'errors.rateLimited',
  // Supabase's built-in mailer only writes to the project's own team.
  email_address_not_authorized: 'errors.emailSendFailed',
  signup_disabled: 'errors.signupDisabled',
  email_provider_disabled: 'errors.providerNotConfigured',
  provider_disabled: 'errors.providerNotConfigured',
  session_expired: 'errors.sessionExpired',
  session_not_found: 'errors.sessionExpired',
  refresh_token_not_found: 'errors.sessionExpired',
  refresh_token_already_used: 'errors.sessionExpired',
  bad_jwt: 'errors.sessionExpired',
  no_authorization: 'errors.sessionExpired',
  reauthentication_needed: 'errors.reauthNeeded',
  reauthentication_not_valid: 'errors.invalidCode',
  // A link whose sign-in state is gone: expired, used, or opened elsewhere.
  flow_state_expired: 'errors.linkExpired',
  flow_state_not_found: 'errors.linkExpired',
  bad_code_verifier: 'errors.linkExpired',
  request_timeout: 'errors.network',
}

export function friendlyError(err, t) {
  // No answer at all (offline, DNS, a timeout) or a 502-504 from a gateway:
  // auth-js reports both as AuthRetryableFetchError. "Something went wrong"
  // hid that it is the connection, which the person can do something about.
  if (err?.name === 'AuthRetryableFetchError') return t('errors.network')
  if (err?.name === 'AuthSessionMissingError') return t('errors.sessionExpired')
  if (err?.name === 'AuthPKCECodeVerifierMissingError') return t('errors.linkOtherDevice')
  if (err?.code === 'weak_password' || Array.isArray(err?.reasons)) {
    const reasons = err.reasons ?? []
    if (reasons.includes('pwned')) return t('errors.passwordPwned')
    if (reasons.includes('characters')) return t('errors.passwordWeak')
    return t('errors.passwordMin')
  }
  if (err?.code && CODE_KEYS[err.code]) return t(CODE_KEYS[err.code])
  if (!err?.message) return t('errors.generic')
  const map = {
    'Invalid login credentials': 'errors.invalidCredentials',
    'User already registered': 'errors.userExists',
    'Email not confirmed': 'errors.emailNotConfirmed',
    'Token has expired or is invalid': 'errors.invalidCode',
    'is invalid': 'errors.invalidEmail',
    // Supabase rejects a malformed address with code `validation_failed` (not
    // `email_address_invalid`) and the text below, which matches none of the
    // other patterns here. The client's own EMAIL_RE normally catches this
    // first, so it only surfaces when the two disagree — exactly when a
    // precise message matters most. Verified live 2026-08-27.
    'Unable to validate email address': 'errors.invalidEmail',
    // Server-side password policy, if it is ever set stricter than the
    // client's 8-character rule. Verified live: code `weak_password`.
    'Password should be at least': 'errors.passwordMin',
    'For security purposes, you can only request this after': 'errors.rateLimited',
    // Distinct from the per-identity cooldown above: this is Supabase's
    // project-wide email-sending quota (code: over_email_send_rate_limit),
    // confirmed live in production — hit after enough OTP/recovery/signup
    // emails go out in a short window on the default built-in email service
    // (no custom SMTP configured). Same user-facing message fits both: the
    // user just needs to wait, regardless of which limit tripped.
    'email rate limit exceeded': 'errors.rateLimited',
    // The SMTP provider refused the message, so GoTrue fails the whole
    // request (500) and NO account is created. Confirmed live: Resend
    // answers 550 "You can only send testing emails to your own email
    // address" for every recipient until a domain is verified, which makes
    // signup impossible for everyone except the project owner.
    //
    // Matched on the shared prefix so confirmation, recovery, magic-link and
    // invite mails all land here. It must NOT fall through to errors.generic
    // ("Something went wrong. Try again.") — retrying cannot succeed until
    // someone changes server configuration, and telling a user to try again
    // sends them into a loop that has no exit.
    'Error sending': 'errors.emailSendFailed',
    'provider is not enabled': 'errors.providerNotConfigured',
    'Unsupported provider': 'errors.providerNotConfigured',
  }
  const key = Object.keys(map).find((k) => err.message.includes(k))
  return key ? t(map[key]) : t('errors.generic')
}

/**
 * Seconds Supabase asks the person to wait before another code, from its
 * per-address limit ("For security purposes, you can only request this after
 * 42 seconds."), or null. The resend timer uses it, so the app's countdown
 * matches the server's instead of offering a resend that will be refused.
 */
export function retryAfterSeconds(err) {
  const match = /only request this after (\d+) seconds?/i.exec(err?.message ?? '')
  if (!match) return null
  const s = Number(match[1])
  return Number.isFinite(s) && s > 0 && s <= 3600 ? s : null
}
