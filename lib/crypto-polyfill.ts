// A secure crypto.getRandomValues on the phone, before the Supabase client is
// created; see src/lib/randomValues.js for why only that function. The web
// already has WebCrypto.
import { getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

import { installRandomValues } from '@/src/lib/randomValues';

if (Platform.OS !== 'web') {
  installRandomValues(globalThis, getRandomValues as <T extends ArrayBufferView | null>(array: T) => T);
}
