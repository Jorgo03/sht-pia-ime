// Types for leads.js, so the phone app (TypeScript) can import it.
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
export type LeadError = 'nameRequired' | 'tooLong' | 'phoneInvalid' | 'emailInvalid';

export interface LeadForm {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: LeadStatus | string | null;
}
export interface LeadRow {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: LeadStatus;
}
export interface WantedLike {
  city?: string | null;
  listing_type?: string | null;
  max_price?: number | string | null;
  min_bedrooms?: number | string | null;
}
export interface ListingLike {
  status?: string | null;
  city?: string | null;
  listing_type?: string | null;
  price?: number | string | null;
  currency?: string | null;
  beds?: number | string | null;
}

export const LEAD_STATUSES: readonly LeadStatus[];
export const LEAD_LIMITS: { name: number; phone: number; email: number; notes: number };
export function leadRow(form: LeadForm): { row: LeadRow; error: null } | { row: null; error: LeadError };
export function fold(value: string | null | undefined): string;
export function leadSearchFilter(query: string | null | undefined): string | null;
export function priceInEur(listing: ListingLike | null | undefined): number | null;
export function matchesWanted(wanted: WantedLike | null | undefined, listing: ListingLike | null | undefined): boolean;
export function wantedMatches<T extends ListingLike>(wanted: WantedLike | null | undefined, listings: readonly T[] | null | undefined): T[];
