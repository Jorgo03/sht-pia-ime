import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared cache for Explore/Home/Map/Property-detail's overlapping
 * property_activity — a query key seen once (same filters+offset, or the
 * same property id) is served from memory instead of re-hitting Supabase
 * every time a screen remounts or regains focus.
 *
 * staleTime: 60s — property listings don't change second-to-second, so a
 * screen revisited within a minute shows cached data instantly with no
 * network round-trip, then quietly revalidates in the background.
 * gcTime: 5min — how long an unused query stays in memory before eviction;
 * long enough that Home -> Detail -> Back doesn't refetch Home's list.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      // RN has no window-focus concept the way web does; Expo apps rely on
      // AppState instead, which react-query doesn't wire up by default —
      // leaving this off rather than have it silently do nothing.
      refetchOnWindowFocus: false,
    },
  },
});
