import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { isOnline } from '@/src/lib/networkState';

/**
 * React Query's idea of "online" on phones comes from NetInfo (AUDIT-009).
 * Offline, queries pause instead of failing one by one, and they refetch by
 * themselves when the connection comes back (refetchOnReconnect in
 * lib/query-client.ts). Imported once, for its side effect, from
 * app/_layout.tsx.
 *
 * The website follows the browser's online and offline events (below): no
 * extra request (NetInfo's web version would fetch a Google URL to test
 * reachability), and nothing during the pre-render, which has no window.
 */
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(isOnline(state));
    }),
  );
} else if (typeof window !== 'undefined') {
  // The website: the browser's online/offline events, as React Query's own
  // listener does, plus the browser's current state when listening starts.
  // Without it, a connection lost before the page finished starting went
  // unnoticed until the next change, and the offline bar never showed.
  onlineManager.setEventListener((setOnline) => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  });
}
