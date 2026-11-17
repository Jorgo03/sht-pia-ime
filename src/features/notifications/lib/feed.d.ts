// Types for feed.js, so the phone app (TypeScript) can import it.
export type NotificationKind =
  | 'message'
  | 'inquiry'
  | 'viewing_requested'
  | 'viewing_updated'
  | 'listing_hidden'
  | 'listing_restored'
  | 'welcome'
  | 'announcement';
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}
type Translate = (key: string, options?: Record<string, unknown>) => string;
export function notificationRoute(n: Pick<AppNotification, 'kind' | 'data'> | null | undefined): string | null;
export function notificationCopy(n: Pick<AppNotification, 'kind' | 'data'>, t: Translate): { title: string; body: string };
export function conversationInPath(pathname: string | null | undefined): string | null;
export function shouldBanner(
  n: AppNotification | null | undefined,
  options?: { pathname?: string | null; now?: number; prefs?: { messages?: boolean; viewings?: boolean } | null },
): boolean;
