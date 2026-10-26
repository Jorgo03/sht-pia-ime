// WebCrypto pieces supabase-js needs on the phone, before the Supabase client
// is created; see src/lib/randomValues.js:
// - a secure crypto.getRandomValues, for the PKCE verifier;
// - crypto.subtle.digest, so the PKCE challenge is SHA-256, not `plain`.
// The web already has WebCrypto.
import { digest, getRandomValues, type CryptoDigestAlgorithm } from 'expo-crypto';
import { Platform } from 'react-native';

import { installRandomValues, installSubtleDigest } from '@/src/lib/randomValues';

if (Platform.OS !== 'web') {
  installRandomValues(globalThis, getRandomValues as <T extends ArrayBufferView | null>(array: T) => T);
  // The names are the same strings: CryptoDigestAlgorithm.SHA256 is 'SHA-256'.
  installSubtleDigest(globalThis, (algorithm, data) => digest(algorithm as CryptoDigestAlgorithm, data));
}
