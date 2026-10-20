// Types for matches.js, so the phone app (TypeScript) can import it.
export interface SavedFilters {
  city?: string | null;
  listing_type?: string | null;
  type?: string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  beds?: number | string | null;
}

type Client = { from: (table: string) => any };

export function applySavedFilters<Q>(query: Q, filters: SavedFilters | null | undefined): Q;
export function countMatches(client: Client, filters: SavedFilters | null | undefined): Promise<number | null>;
export function newMatchCount(current: number | null | undefined, lastSeen: number | null | undefined): number;
export function markSeen(client: Client, id: string, current: number | null | undefined): Promise<boolean>;
