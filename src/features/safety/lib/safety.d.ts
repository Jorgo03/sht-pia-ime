// Types for safety.js, so the phone app (TypeScript) can import it.
export type ReportReason = 'spam' | 'scam' | 'wrong_info' | 'unavailable' | 'offensive' | 'other';
export type ReportResult = 'sent' | 'already' | 'failed';

export const REPORT_REASONS: readonly ReportReason[];
export const MAX_REPORT_DETAILS: number;

// Any Supabase client; typed loosely so both apps' clients fit.
type Client = { from: (table: string) => any };

export function fileReport(
  client: Client,
  target: { propertyId?: string | null; userId?: string | null; reason: ReportReason; details?: string | null },
): Promise<ReportResult>;
export function blockUser(client: Client, blockedId: string): Promise<boolean>;
export function unblockUser(client: Client, blockedId: string): Promise<boolean>;
export function loadBlockedIds(client: Client): Promise<Set<string>>;
export function isBlockedSendError(error: { code?: string } | null | undefined): boolean;
