// Types for moderation.js, so the phone app's web build can import it.
type Client = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

export const PAGE_SIZE: number;
export const QUEUES: readonly ('open' | 'closed')[];

export interface ModerationReport {
  id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
  reviewed_at: string | null;
  resolution_note: string | null;
  property_id: string | null;
  reported_user_id: string | null;
  listing: { id: string; title: string | null; status: string; moderation_hold: boolean; owner_id: string | null } | null;
  person: { id: string; full_name: string | null; role: string | null } | null;
}

export function isModerator(client: Client): Promise<boolean>;
export function loadReports(
  client: Client,
  options?: { queue?: 'open' | 'closed'; offset?: number },
): Promise<{ rows: ModerationReport[]; more: boolean } | null>;
export function setListingHidden(client: Client, propertyId: string, hide: boolean): Promise<boolean>;
export function resolveReport(client: Client, reportId: string, status: 'actioned' | 'dismissed', note?: string | null): Promise<boolean>;
