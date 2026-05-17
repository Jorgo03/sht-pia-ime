import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isSSR = typeof window === 'undefined';

const storage =
  !isSSR && Platform.OS !== 'web'
    ? require('@react-native-async-storage/async-storage').default
    : isSSR
      ? {
          getItem: () => Promise.resolve(null),
          setItem: () => Promise.resolve(),
          removeItem: () => Promise.resolve(),
        }
      : {
          getItem: (key: string) => {
            try {
              return Promise.resolve(window.localStorage.getItem(key));
            } catch {
              return Promise.resolve(null);
            }
          },
          setItem: (key: string, value: string) => {
            try {
              window.localStorage.setItem(key, value);
            } catch {}
            return Promise.resolve();
          },
          removeItem: (key: string) => {
            try {
              window.localStorage.removeItem(key);
            } catch {}
            return Promise.resolve();
          },
        };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: !isSSR,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
