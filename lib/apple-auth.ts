import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from './supabase';

export async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: new Error('No identity token received from Apple') };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    return { error: error as Error | null };
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      return { error: new Error('Apple Sign In was cancelled') };
    }
    return { error: e as Error };
  }
}
