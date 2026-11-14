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
 * The website keeps React Query's own listener: it follows the browser's
 * online and offline events, needs no extra request (NetInfo's web version
 * would fetch a Google URL to test reachability), and does nothing during the
 * pre-render, which has no window.
 */
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(isOnline(state));
    }),
  );
}
