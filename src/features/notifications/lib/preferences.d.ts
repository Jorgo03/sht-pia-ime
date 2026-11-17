// Types for preferences.js, so the phone app (TypeScript) can import it.
export interface NotificationPreferences {
  messages: boolean;
  viewings: boolean;
}
type Client = { from: (table: string) => any };
export const DEFAULT_PREFERENCES: Readonly<NotificationPreferences>;
export function loadPreferences(client: Client, userId: string): Promise<NotificationPreferences>;
export function readPreferences(client: Client, userId: string): Promise<{ ok: boolean; prefs: NotificationPreferences }>;
export function savePreferences(client: Client, prefs: NotificationPreferences): Promise<boolean>;
