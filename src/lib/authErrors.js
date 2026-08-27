// Pure auth-form helpers, split out of Profile.jsx so they're testable
// without a JSX/CSS-aware loader (this repo's `npm test` is plain
// `node --test`, no bundler). `t` is passed in rather than imported so this
// stays decoupled from react-i18next — callers pass their own useTranslation() `t`.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function friendlyError(err, t) {
  if (!err?.message) return t('errors.generic')
  if (err.code === 'email_address_invalid') return t('errors.invalidEmail')
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
