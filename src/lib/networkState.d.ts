// Types for networkState.js, so the phone app (TypeScript) can import it.
export function isOnline(
  state: { isConnected?: boolean | null; isInternetReachable?: boolean | null } | null | undefined,
): boolean;
