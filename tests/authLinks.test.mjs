import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authRedirectError, emailLinkFrom, hasAuthCode, linkErrorKey } from '../src/features/auth/lib/authLinks.js'

const SITE = 'https://shtepia.example'
const HASH = 'pkce_' + 'a'.repeat(56)

test('reads the token_hash links the templates send', () => {
  assert.deepEqual(emailLinkFrom(`${SITE}/auth/confirm?token_hash=${HASH}&type=recovery`), { tokenHash: HASH, type: 'recovery' })
  assert.deepEqual(emailLinkFrom(`${SITE}/auth/confirm?token_hash=${'b'.repeat(56)}&type=email`), { tokenHash: 'b'.repeat(56), type: 'email' })
})

test('refuses unknown types, odd characters and missing parts', () => {
  assert.equal(emailLinkFrom(`${SITE}/auth/confirm?token_hash=${HASH}&type=admin`), null)
  assert.equal(emailLinkFrom(`${SITE}/auth/confirm?token_hash=abc<script>&type=email`), null)
  assert.equal(emailLinkFrom(`${SITE}/auth/confirm?type=email`), null)
  assert.equal(emailLinkFrom(`${SITE}/auth/confirm?token_hash=short&type=email`), null)
  assert.equal(emailLinkFrom('not a url'), null)
})

test('finds Supabase errors in the query or the fragment', () => {
  assert.deepEqual(
    authRedirectError(`${SITE}/profile#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`),
    { error: 'access_denied', code: 'otp_expired', description: 'Email link is invalid or has expired' },
  )
  assert.equal(authRedirectError(`${SITE}/auth/callback?error=server_error`).error, 'server_error')
  assert.equal(authRedirectError(`${SITE}/auth/callback?code=x`), null)
  assert.equal(hasAuthCode(`${SITE}/profile?code=x`), true)
  assert.equal(hasAuthCode(`${SITE}/profile`), false)
})

test('an expired or used link says so; anything else is "not valid"', () => {
  assert.equal(linkErrorKey({ error: 'access_denied', code: 'otp_expired' }), 'errors.linkExpired')
  assert.equal(linkErrorKey({ code: 'flow_state_expired' }), 'errors.linkExpired')
  assert.equal(linkErrorKey({ error: 'access_denied' }), 'errors.oauthFailed')
  assert.equal(linkErrorKey({ code: 'validation_failed' }), 'errors.linkInvalid')
  assert.equal(linkErrorKey(null), 'errors.linkInvalid')
})
