import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installRandomValues, installSubtleDigest } from '../src/lib/randomValues.js'

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

// crypto.subtle.digest: Google sign-in's PKCE challenge becomes SHA-256.

const realSha = async (name, data) => (await import('node:crypto')).webcrypto.subtle.digest(name, data)

test('no subtle: digest is installed and gives the real SHA-256', async () => {
  const g = { crypto: { getRandomValues: fill } }
  assert.equal(installSubtleDigest(g, realSha), true)
  assert.deepEqual(Object.keys(g.crypto.subtle), ['digest'])
  const data = new TextEncoder().encode('abc')
  const hex = Buffer.from(await g.crypto.subtle.digest('SHA-256', data)).toString('hex')
  assert.equal(hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const viaObject = Buffer.from(await g.crypto.subtle.digest({ name: 'sha-256' }, data)).toString('hex')
  assert.equal(viaObject, hex)
})

test('an unsupported algorithm rejects, and a real subtle is never replaced', async () => {
  const g = {}
  installSubtleDigest(g, realSha)
  await assert.rejects(g.crypto.subtle.digest('MD5', new Uint8Array()), /Unsupported digest/)
  const own = { digest: () => 'own' }
  const h = { crypto: { subtle: own } }
  assert.equal(installSubtleDigest(h, realSha), false)
  assert.equal(h.crypto.subtle, own)
})

test('supabase-js PKCE uses s256 with the stand-in', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const g = {}
  const node = (await import('node:crypto')).webcrypto
  installRandomValues(g, (a) => node.getRandomValues(a))
  installSubtleDigest(g, realSha)
  Object.defineProperty(globalThis, 'crypto', { value: g.crypto, configurable: true, writable: true })
  try {
    const { getCodeChallengeAndMethod } = await import('@supabase/auth-js/dist/main/lib/helpers.js')
    const store = new Map()
    const storage = { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v) }, removeItem: async (k) => { store.delete(k) } }
    const [challenge, method] = await getCodeChallengeAndMethod(storage, 'sb-test')
    assert.equal(method, 's256')
    const verifier = [...store.values()][0]
    assert.notEqual(challenge, verifier)
    assert.match(challenge, /^[A-Za-z0-9_-]{43}$/)
  } finally {
    Object.defineProperty(globalThis, 'crypto', saved)
  }
})

test('the phone app never calls getClaims, which a digest-only subtle cannot serve', async () => {
  const { execFileSync } = await import('node:child_process')
  let hits = ''
  try {
    hits = execFileSync('git', ['grep', '-n', 'getClaims', '--', 'app', 'components', 'contexts', 'hooks', 'lib', 'src', ':!src/lib/randomValues.js'], { encoding: 'utf8' })
  } catch (e) {
    if (e.status !== 1) throw e // 1 = no match
  }
  assert.equal(hits, '', `getClaims needs full WebCrypto on the phone; see src/lib/randomValues.js:\n${hits}`)
})
