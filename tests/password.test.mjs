import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  changePassword,
  hasPasswordSignIn,
  newPasswordError,
  passwordStrengthError,
  providerLabels,
} from '../src/features/auth/lib/password.js'

// The signed-in password change runs the real supabase-js against a fake
// Auth server, so what is checked is what the SDK actually sends and how it
// reads Supabase's real error replies.

const EMAIL = 'a@example.com'
const CURRENT = 'old-password-1'

function session() {
  return {
    access_token: 'header.payload.signature',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', email: EMAIL },
  }
}

function fakeServer({ updateReply = [200, session().user], logoutStatus = 204 } = {}) {
  const calls = []
  const reply = (status, body) =>
    new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ path: url.pathname, query: url.search, method: init.method, body })
    if (url.pathname.endsWith('/token')) {
      return body.password === CURRENT
        ? reply(200, session())
        : reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    if (url.pathname.endsWith('/user')) return reply(...updateReply)
    if (url.pathname.endsWith('/logout')) return reply(logoutStatus, null)
    return reply(404, {})
  }
  const store = new Map()
  const client = createClient('https://example.supabase.co', 'anon-key', {
    global: { fetch },
    auth: {
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return { client, calls }
}

test('the current password is checked before anything changes', async () => {
  const { client, calls } = fakeServer()
  const result = await changePassword(client, { email: EMAIL, currentPassword: 'wrong', newPassword: 'brand-new-pass' })
  assert.deepEqual(result, { status: 'wrongCurrent' })
  assert.equal(calls.some((c) => c.path.endsWith('/user')), false, 'no password update was sent')
})

test('a right current password changes it and signs the other devices out', async () => {
  const { client, calls } = fakeServer()
  const result = await changePassword(client, { email: EMAIL, currentPassword: CURRENT, newPassword: 'brand-new-pass' })
  assert.deepEqual(result, { status: 'changed', othersSignedOut: true })
  assert.deepEqual(calls.map((c) => c.path.split('/').pop()), ['token', 'user', 'logout'])
  assert.equal(calls[1].method, 'PUT')
  assert.equal(calls[1].body.password, 'brand-new-pass')
  assert.match(calls[2].query, /scope=others/)
})

test('Supabase refusing the new password is reported, not swallowed', async () => {
  const { client } = fakeServer({ updateReply: [422, { error_code: 'same_password', msg: 'New password should be different from the old password.' }] })
  const result = await changePassword(client, { email: EMAIL, currentPassword: CURRENT, newPassword: CURRENT + 'x' })
  assert.equal(result.status, 'failed')
  assert.equal(result.error.code, 'same_password')
})

test('a breached-password refusal keeps its reasons for the message', async () => {
  const { client } = fakeServer({ updateReply: [422, { error_code: 'weak_password', msg: 'Password is known to be weak', weak_password: { reasons: ['pwned'] } }] })
  const result = await changePassword(client, { email: EMAIL, currentPassword: CURRENT, newPassword: 'password123' })
  assert.equal(result.status, 'failed')
  assert.deepEqual(result.error.reasons, ['pwned'])
})

test('a changed password still counts when signing the others out fails', async () => {
  const { client } = fakeServer({ logoutStatus: 500 })
  const result = await changePassword(client, { email: EMAIL, currentPassword: CURRENT, newPassword: 'brand-new-pass' })
  assert.deepEqual(result, { status: 'changed', othersSignedOut: false })
})

test('no connection is a failure, never a throw', async () => {
  const client = createClient('https://example.supabase.co', 'anon-key', {
    global: { fetch: () => Promise.reject(new TypeError('Network request failed')) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const result = await changePassword(client, { email: EMAIL, currentPassword: CURRENT, newPassword: 'brand-new-pass' })
  assert.equal(result.status, 'failed')
  assert.equal(result.error.name, 'AuthRetryableFetchError')
})

test('new password rules: length, bcrypt bytes, same as current, confirmation', () => {
  assert.equal(passwordStrengthError('short'), 'errors.passwordMin')
  assert.equal(passwordStrengthError('a'.repeat(72)), null)
  assert.equal(passwordStrengthError('a'.repeat(73)), 'errors.passwordTooLong')
  assert.equal(passwordStrengthError('ë'.repeat(37)), 'errors.passwordTooLong', '74 bytes in 37 letters')
  assert.equal(newPasswordError('long-enough', 'long-enough', { current: 'long-enough' }), 'errors.passwordSame')
  assert.equal(newPasswordError('long-enough', 'long-enougH'), 'errors.passwordMismatch')
  assert.equal(newPasswordError('long-enough', 'long-enough', { current: 'other' }), null)
})

test('only accounts with an email identity get a password form', () => {
  assert.equal(hasPasswordSignIn({ app_metadata: { provider: 'email' } }), true)
  assert.equal(hasPasswordSignIn({ identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } }), false)
  assert.equal(hasPasswordSignIn({ identities: [{ provider: 'google' }, { provider: 'email' }] }), true)
  assert.equal(hasPasswordSignIn({}), true, 'unknown counts as email')
  assert.deepEqual(providerLabels({ app_metadata: { providers: ['apple', 'linkedin_oidc'] } }), ['Apple', 'LinkedIn'])
})
