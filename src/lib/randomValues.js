// Give the phone app a secure crypto.getRandomValues (lib/crypto-polyfill.ts).
// Pure, for `npm test`.
//
// React Native has no global `crypto`, so supabase-js made the PKCE code
// verifier for Google sign-in with Math.random(), which is predictable. This
// installs only getRandomValues, from expo-crypto, and only where it is
// missing. crypto.subtle is deliberately left alone: supabase-js takes
// `'subtle' in crypto` as a sign that full WebCrypto exists (getClaims calls
// importKey and verify), so a digest-only stand-in would break that path.
export function installRandomValues(target, getRandomValues) {
  if (!target || typeof getRandomValues !== 'function') return false
  if (target.crypto && typeof target.crypto.getRandomValues === 'function') return false
  if (!target.crypto) target.crypto = {}
  target.crypto.getRandomValues = getRandomValues
  return true
}
