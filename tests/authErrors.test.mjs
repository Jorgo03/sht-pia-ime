// Unit tests for the auth-form pure helpers — email validation and the
// Supabase-error-to-user-facing-message mapper. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMAIL_RE, friendlyError } from '../src/lib/authErrors.js'

// A stand-in for react-i18next's t() — returns the key itself, so
// assertions can check which key was chosen without needing real
// translations loaded.
const t = (key) => key

// ---------- EMAIL_RE ----------

test('accepts well-formed emails', () => {
  assert.equal(EMAIL_RE.test('user@example.com'), true)
  assert.equal(EMAIL_RE.test('first.last+tag@sub.example.co'), true)
})

test('rejects malformed emails', () => {
  assert.equal(EMAIL_RE.test('not-an-email'), false)
  assert.equal(EMAIL_RE.test('missing-domain@'), false)
  assert.equal(EMAIL_RE.test('@missing-local.com'), false)
  assert.equal(EMAIL_RE.test('spaces in@email.com'), false)
  assert.equal(EMAIL_RE.test(''), false)
})

test('rejects leading/trailing whitespace (callers must trim first)', () => {
  assert.equal(EMAIL_RE.test(' user@example.com'), false)
  assert.equal(EMAIL_RE.test('user@example.com '), false)
})

// ---------- friendlyError ----------

test('maps wrong credentials to the invalid-credentials key', () => {
  assert.equal(friendlyError({ message: 'Invalid login credentials' }, t), 'errors.invalidCredentials')
})

test('maps duplicate signup to the user-exists key', () => {
  assert.equal(friendlyError({ message: 'User already registered' }, t), 'errors.userExists')
})

test('maps unconfirmed email to the emailNotConfirmed key', () => {
  assert.equal(friendlyError({ message: 'Email not confirmed' }, t), 'errors.emailNotConfirmed')
})

test('maps an expired/invalid OTP code to the invalidCode key', () => {
  assert.equal(friendlyError({ message: 'Token has expired or is invalid' }, t), 'errors.invalidCode')
})

test('maps a rate-limit message to the rateLimited key', () => {
  assert.equal(
    friendlyError({ message: 'For security purposes, you can only request this after 12 seconds' }, t),
    'errors.rateLimited',
  )
})

test('maps a disabled OAuth provider to providerNotConfigured, both phrasings', () => {
  assert.equal(friendlyError({ message: 'provider is not enabled' }, t), 'errors.providerNotConfigured')
  assert.equal(friendlyError({ message: 'Unsupported provider: apple' }, t), 'errors.providerNotConfigured')
})

test('maps the email_address_invalid error code directly, ignoring message text', () => {
  assert.equal(
    friendlyError({ code: 'email_address_invalid', message: 'Unable to validate email address: invalid format' }, t),
    'errors.invalidEmail',
  )
})

test('falls back to the generic message for an unrecognized error', () => {
  assert.equal(friendlyError({ message: 'Something Supabase never documented' }, t), 'errors.generic')
})

test('falls back to the generic message when there is no error message at all', () => {
  assert.equal(friendlyError({}, t), 'errors.generic')
  assert.equal(friendlyError(null, t), 'errors.generic')
  assert.equal(friendlyError(undefined, t), 'errors.generic')
})

test('never leaks the raw Supabase error text back to the caller', () => {
  const raw = 'Invalid login credentials'
  const result = friendlyError({ message: raw }, t)
  assert.notEqual(result, raw)
})

// ---------- SMTP failure: the bug that made signup impossible ----------
//
// Reproduced live against production on 2026-08-27: POST /auth/v1/signup
// returned 500 with
//
//   "Error sending confirmation email"
//   550 "You can only send testing emails to your own email address
//        (…). To send emails to other recipients, please verify a domain
//        at resend.com/domains…"
//
// GoTrue fails the WHOLE request when the SMTP provider refuses, so no
// account is created — signup was impossible for every address except the
// project owner's. Before this mapping the user was told "Something went
// wrong. Try again.", which is advice that can never succeed.

test('an SMTP send failure is not reported as a retryable generic error', () => {
  assert.equal(
    friendlyError({ message: 'Error sending confirmation email' }, t),
    'errors.emailSendFailed',
  )
  assert.notEqual(
    friendlyError({ message: 'Error sending confirmation email' }, t),
    'errors.generic',
  )
})

test('recovery, magic-link and invite mail failures map to the same cause', () => {
  // All four share GoTrue's "Error sending …" prefix; one mapping covers them
  // because the fix is identical in every case — server configuration.
  for (const message of [
    'Error sending recovery email',
    'Error sending magic link email',
    'Error sending invite email',
  ]) {
    assert.equal(friendlyError({ message }, t), 'errors.emailSendFailed', message)
  }
})

test('the SMTP mapping does not swallow more specific auth errors', () => {
  // 'Error sending' must not win over a genuine credential or duplicate-account
  // failure, which have their own actionable messages.
  assert.equal(friendlyError({ message: 'Invalid login credentials' }, t), 'errors.invalidCredentials')
  assert.equal(friendlyError({ message: 'User already registered' }, t), 'errors.userExists')
  assert.equal(friendlyError({ message: 'Email not confirmed' }, t), 'errors.emailNotConfirmed')
})

test('the real Supabase texts for a bad address and a weak password are mapped', () => {
  // Exact strings returned by production on 2026-08-27. Neither matched any
  // existing pattern, so both used to surface as the generic message.
  assert.equal(
    friendlyError({ message: 'Unable to validate email address: invalid format' }, t),
    'errors.invalidEmail',
  )
  assert.equal(
    friendlyError({ message: 'Password should be at least 8 characters.' }, t),
    'errors.passwordMin',
  )
})
