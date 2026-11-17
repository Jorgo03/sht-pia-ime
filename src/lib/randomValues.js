// Give the phone app a secure crypto.getRandomValues (lib/crypto-polyfill.ts).
// Pure, for `npm test`.
//
// React Native has no global `crypto`, so supabase-js made the PKCE code
// verifier for Google sign-in with Math.random(), which is predictable. This
// installs getRandomValues, from expo-crypto, and only where it is missing.
export function installRandomValues(target, getRandomValues) {
  if (!target || typeof getRandomValues !== 'function') return false
  if (target.crypto && typeof target.crypto.getRandomValues === 'function') return false
  if (!target.crypto) target.crypto = {}
  target.crypto.getRandomValues = getRandomValues
  return true
}

const DIGESTS = new Set(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'])

/**
 * A crypto.subtle with digest() only, from expo-crypto, where there is no
 * subtle at all. Without it supabase-js sends Google sign-in's PKCE challenge
 * as `plain`, the verifier itself; with it, as SHA-256 (`s256`).
 *
 * Only digest: supabase-js reads `'subtle' in crypto` as full WebCrypto in one
 * other place, getClaims(), which would then call importKey and verify. The
 * phone app never calls getClaims (tests/randomValues.test.mjs checks), and
 * an unknown method fails loudly rather than pretending to verify.
 */
export function installSubtleDigest(target, digest) {
  if (!target || typeof digest !== 'function') return false
  if (target.crypto && target.crypto.subtle) return false
  if (!target.crypto) target.crypto = {}
  target.crypto.subtle = {
    digest(algorithm, data) {
      const name = String(typeof algorithm === 'string' ? algorithm : algorithm?.name ?? '').toUpperCase()
      if (!DIGESTS.has(name)) return Promise.reject(new Error(`Unsupported digest: ${name}`))
      return Promise.resolve().then(() => digest(name, data))
    },
  }
  return true
}

