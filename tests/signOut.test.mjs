import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { signOutOfDevice } from '../src/lib/signOut.js'

// Signing out with no connection must still sign this device out. These run
// the real supabase-js against a fetch that fails the way a phone with no
// signal does.

const KEY = 'sb-example-auth-token'

function deviceWithSession() {
  const store = new Map()
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  }
  const session = {
    access_token: 'header.payload.signature',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', email: 'a@example.com' },
  }
  store.set(KEY, JSON.stringify(session))
  const offline = () => Promise.reject(new TypeError('Network request failed'))
  const client = createClient('https://example.supabase.co', 'anon-key', {
    global: { fetch: offline },
    auth: { storage, storageKey: KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { client, store }
}

test('offline, supabase-js on its own keeps the stored session (why the helper exists)', async () => {
  const { client, store } = deviceWithSession()
  const { error } = await client.auth.signOut()
  assert.ok(error, 'the /logout request failed')
  assert.ok(store.has(KEY), 'and the session is still stored, so it comes back on the next launch')
})

test('offline, signOutOfDevice forgets the session and still reports the failed revoke', async () => {
  const { client, store } = deviceWithSession()
  const events = []
  client.auth.onAuthStateChange((event) => events.push(event))
  const { error } = await signOutOfDevice(client)
  assert.ok(error, 'the server could not be told')
  assert.equal(store.has(KEY), false, 'the stored session is gone')
  const { data } = await client.auth.getSession()
  assert.equal(data.session, null)
  assert.ok(events.includes('SIGNED_OUT'), 'listeners hear SIGNED_OUT, as after a normal sign-out')
})

test('online, a normal sign-out is left to supabase-js', async () => {
  let removed = 0
  const client = { auth: { signOut: async () => ({ error: null }), _removeSession: async () => { removed++ } } }
  assert.deepEqual(await signOutOfDevice(client), { error: null })
  assert.equal(removed, 0)
})

test('if even the local removal fails, that error is returned instead of thrown', async () => {
  const boom = new Error('storage unavailable')
  const client = { auth: { signOut: async () => ({ error: new Error('offline') }), _removeSession: async () => { throw boom } } }
  assert.deepEqual(await signOutOfDevice(client), { error: boom })
})
