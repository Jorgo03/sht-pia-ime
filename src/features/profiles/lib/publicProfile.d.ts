// Types for publicProfile.js, so the phone app (TypeScript) can import it.
export type ProfileKind = 'agent' | 'client';
export interface PublicProfileRow {
  id: string;
  kind: ProfileKind;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  agency_name: string | null;
  listing_count: number | string | null;
}
export interface PublicProfileView {
  id: string | null;
  kind: ProfileKind;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  office: string | null;
  listingCount: number;
}
export const PROFILE_PAGE_SIZE: number;
export function isUserId(value: unknown): value is string;
export function fetchPublicProfile(client: unknown, userId: string): Promise<PublicProfileRow | null>;
export function publicProfileView(row: PublicProfileRow | null | undefined): PublicProfileView | null;
export function profileInitials(name: string | null | undefined): string;
export function fetchPublisherListings<T = Record<string, unknown>>(
  client: unknown,
  userId: string,
  page?: number,
): Promise<{ rows: T[]; total: number }>;
export function otherParticipant(
  conversation: { client_id?: string | null; agent_id?: string | null } | null | undefined,
  viewerId: string | null | undefined,
): string | null;
