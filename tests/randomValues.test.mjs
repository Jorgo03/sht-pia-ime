import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installRandomValues } from '../src/lib/randomValues.js'

// lib/crypto-polyfill.ts: Supabase's PKCE verifier must come from a secure
// random source on the phone, where React Native has no global crypto.

const fill = (a) => { a.fill(7); return a }

test('no crypto at all: getRandomValues is installed, and nothing else', () => {
  const g = {}
  assert.equal(installRandomValues(g, fill), true)
  assert.equal(typeof g.crypto.getRandomValues, 'function')
  assert.equal('subtle' in g.crypto, false)
  assert.deepEqual([...g.crypto.getRandomValues(new Uint32Array(2))], [7, 7])
})

test('an existing getRandomValues is never replaced', () => {
  const own = (a) => a
  const g = { crypto: { getRandomValues: own, subtle: {} } }
  assert.equal(installRandomValues(g, fill), false)
  assert.equal(g.crypto.getRandomValues, own)
})

test('a crypto object without getRandomValues gains it and keeps the rest', () => {
  const g = { crypto: { randomUUID: () => 'x' } }
  assert.equal(installRandomValues(g, fill), true)
  assert.equal(g.crypto.randomUUID(), 'x')
  assert.equal(typeof g.crypto.getRandomValues, 'function')
})

test('with this in place, supabase-js takes its secure branch', async () => {
  // generatePKCEVerifier uses Math.random only when `crypto` is undefined.
  const saved = globalThis.crypto
  const g = {}
  installRandomValues(g, (a) => saved.getRandomValues(a))
  const arr = g.crypto.getRandomValues(new Uint32Array(56))
  assert.equal(arr.length, 56)
  assert.ok(arr.some((n) => n !== 0))
})
