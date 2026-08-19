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
    'For security purposes, you can only request this after': 'errors.rateLimited',
    'provider is not enabled': 'errors.providerNotConfigured',
    'Unsupported provider': 'errors.providerNotConfigured',
  }
  const key = Object.keys(map).find((k) => err.message.includes(k))
  return key ? t(map[key]) : t('errors.generic')
}
