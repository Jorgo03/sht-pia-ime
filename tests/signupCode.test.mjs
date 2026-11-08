import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  blockedCodeKey,
  CODE_TTL_S,
  codeExpiry,
  existingAccountError,
  formatCountdown,
  isExistingAccount,
  isUnverifiedEmailUser,
  MAX_CODE_ATTEMPTS,
  pendingCodeNote,
  RESEND_WAIT_S,
  restorableCode,
  rejectedCodeKey,
  secondsLeft,
} from '../src/features/auth/lib/signupCode.js'
import { friendlyError } from '../src/lib/authErrors.js'

const REJECTED = { code: 'otp_expired', message: 'Token has expired or is invalid' }
const NOW = 1_800_000_000_000

test('a code lasts 10 minutes and the countdown reads m:ss', () => {
  assert.equal(CODE_TTL_S, 600)
  assert.equal(codeExpiry(NOW) - NOW, 600_000)
  assert.equal(secondsLeft(codeExpiry(NOW), NOW), 600)
  assert.equal(secondsLeft(NOW + 1500, NOW), 2)
  assert.equal(secondsLeft(NOW - 1, NOW), 0)
  assert.equal(secondsLeft(null, NOW), null)
  assert.equal(formatCountdown(600), '10:00')
  assert.equal(formatCountdown(61), '1:01')
  assert.equal(formatCountdown(-3), '0:00')
})

test('an expired code or one past the attempt cap is never sent', () => {
  const expiresAt = NOW + 1000
  assert.equal(blockedCodeKey({ expiresAt, attempts: 0, now: NOW }), null)
  assert.equal(blockedCodeKey({ expiresAt, attempts: 0, now: expiresAt }), 'errors.codeExpired')
  assert.equal(blockedCodeKey({ expiresAt, attempts: MAX_CODE_ATTEMPTS, now: NOW }), 'errors.codeAttempts')
  // Unknown expiry: only the attempt cap applies.
  assert.equal(blockedCodeKey({ expiresAt: null, attempts: 1, now: NOW }), null)
})

test('a refused code reads as wrong before the expiry and expired after it', () => {
  const expiresAt = NOW + 60_000
  assert.equal(rejectedCodeKey(REJECTED, { expiresAt, attempts: 1, now: NOW }), 'errors.codeIncorrect')
  assert.equal(rejectedCodeKey(REJECTED, { expiresAt, attempts: 1, now: expiresAt + 1 }), 'errors.codeExpired')
  assert.equal(rejectedCodeKey(REJECTED, { expiresAt, attempts: MAX_CODE_ATTEMPTS, now: NOW }), 'errors.codeAttempts')
  // Matched on the text too, for an auth-js that drops the code.
  assert.equal(rejectedCodeKey({ message: REJECTED.message }, { expiresAt, attempts: 1, now: NOW }), 'errors.codeIncorrect')
  // Unknown start: the clock cannot tell, so the shared wording stays.
  assert.equal(rejectedCodeKey(REJECTED, { expiresAt: null, attempts: 1, now: NOW }), 'errors.invalidCode')
  // Anything else is not about the code.
  assert.equal(rejectedCodeKey({ name: 'AuthRetryableFetchError' }, { expiresAt, attempts: 1, now: NOW }), null)
  assert.equal(rejectedCodeKey(null, { expiresAt, attempts: 1, now: NOW }), null)
})

test('a sign-up for a registered address is recognised, an unconfirmed one is not', () => {
  assert.equal(isExistingAccount({ user: { id: 'x', identities: [] }, session: null }), true)
  assert.equal(isExistingAccount({ user: { id: 'x', identities: [{ provider: 'email' }] }, session: null }), false)
  assert.equal(isExistingAccount({ user: { id: 'x' }, session: null }), false)
  assert.equal(isExistingAccount({ user: { id: 'x', identities: [] }, session: { access_token: 't' } }), false)
  assert.equal(isExistingAccount(null), false)
  const t = (k) => k
  assert.equal(friendlyError(existingAccountError(), t), 'errors.userExists')
})

test('only an email account without a confirmed address is refused a session', () => {
  assert.equal(isUnverifiedEmailUser({ app_metadata: { provider: 'email' } }), true)
  assert.equal(isUnverifiedEmailUser({}), true)
  assert.equal(isUnverifiedEmailUser({ app_metadata: { provider: 'email' }, email_confirmed_at: '2026-01-01T00:00:00Z' }), false)
  assert.equal(isUnverifiedEmailUser({ confirmed_at: '2026-01-01T00:00:00Z' }), false)
  assert.equal(isUnverifiedEmailUser({ app_metadata: { provider: 'google' } }), false)
  assert.equal(isUnverifiedEmailUser(null), false)
})

test('a code in progress is restored only while it can still work', () => {
  const sentAt = 1_000_000
  const note = pendingCodeNote('a@b.al', sentAt)
  assert.doesNotMatch(note, /token|code/i, 'the address and the time only')
  assert.deepEqual(restorableCode(note, sentAt + 10_000), { email: 'a@b.al', expiresAt: sentAt + CODE_TTL_S * 1000, resendWait: RESEND_WAIT_S - 10 })
  assert.equal(restorableCode(note, sentAt + RESEND_WAIT_S * 1000 + 5).resendWait, 0, 'the resend is open again')
  assert.equal(restorableCode(note, sentAt + CODE_TTL_S * 1000), null, 'expired')
  assert.equal(restorableCode(note, sentAt - 1), null, 'a clock moved backwards proves nothing')
  for (const bad of ['', 'nonsense', 'null', '{}', '{"email":"","sentAt":1}', '{"email":"a@b.al"}']) assert.equal(restorableCode(bad, sentAt), null, bad)
})

test('the resend wait is within 30 to 60 seconds and not shorter than the server allows', () => {
  assert.equal(RESEND_WAIT_S, 60)
})
