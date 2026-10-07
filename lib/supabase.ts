import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// These were non-null assertions, which only silence the type checker — at
// runtime a missing value reached createClient() and surfaced as an opaque
// failure from inside supabase-js, far from the actual cause. The web client
// (src/lib/supabase.js) already fails loudly and by name; this matches it.
// EXPO_PUBLIC_ is the prefix that makes the value reach the bundle at all, so
// a var set without it is silently undefined here — worth naming explicitly.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). ' +
      'Copy .env.example to .env and fill both in, then restart Metro with a cleared cache ' +
      '(npx expo start --clear) — the bundler inlines these at build time.',
  );
}

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

/**
 * supabase-js puts no timeout on a request, and neither does React Native's
 * fetch in any useful sense (iOS waits ~60s per attempt). When the backend is
 * unreachable — a paused project, a network that silently drops the
 * connection, a wrong URL in .env.local — every screen sat on loading
 * skeletons with no error and no way to retry, because the query never
 * settled. Bounding it lets the existing error + retry states actually show.
 *
 * Only data and auth requests are bounded. Storage uploads (photos, video)
 * and Edge Functions (the AI calls) can legitimately run longer than this.
 */
const REQUEST_TIMEOUT_MS = 15_000;
const BOUNDED_PATHS = ['/rest/v1/', '/auth/v1/'];

const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : 'url' in input ? input.url : String(input);
  if (!BOUNDED_PATHS.some((p) => url.includes(p))) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // supabase-js passes its own signal for .abortSignal(); honour it too.
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort());
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: !isSSR,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
