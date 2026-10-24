// Types for loadNotifications.js, so the phone app (TypeScript) can import it.
export function loadNotifications<T>(input: {
  platform: string;
  inExpoGo: boolean;
  hasNativeModule: (name: string) => boolean;
  load: () => T;
  onError?: (error: unknown) => void;
}): T | null;
