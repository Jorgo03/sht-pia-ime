import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { appleFullName } from '@/src/features/auth/lib/appleName';

import { supabase } from './supabase';

// Native Sign in with Apple (docs/LAUNCH_TASKS.md F8).
//
// - Nonce: Apple gets the SHA-256 of a fresh random value and puts it in the
//   identity token; Supabase gets the raw value and checks the two match, so
//   a token captured elsewhere cannot be replayed into this app.
// - Name: Apple sends it only on the first authorisation and never inside the
//   token, so it is saved here (user metadata, and the profile when it has no
//   name yet). A failure to save it never fails the sign-in.
// - Cancel: closing Apple's sheet is not an error; it resolves with
//   { error: null, cancelled: true } and the screen shows nothing.
export async function signInWithAppleNative(): Promise<{ error: Error | null; cancelled?: boolean }> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: new Error('No identity token received from Apple') };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { error: error as Error };

    const name = appleFullName(credential.fullName);
    if (name && data.user) await saveAppleName(data.user.id, name);
    return { error: null };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { error: null, cancelled: true };
    return { error: e as Error };
  }
}

async function saveAppleName(userId: string, fullName: string) {
  try {
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    // Only fill an empty name: never overwrite one the person chose.
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).is('full_name', null);
  } catch {
    // The account works without a name; the person can add one in Edit profile.
  }
}
