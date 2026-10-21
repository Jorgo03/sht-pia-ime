// Types for plans.js, so the phone app's web build can import it.
export interface PlanOption {
  id: string;
  months: number | null;
  priceCents: number;
  currency: string;
}
export interface PlanCard {
  key: string;
  kind: 'agency_subscription' | 'promotion' | string;
  tier: string;
  name: Record<string, string>;
  listingCap: number | null;
  credits: number;
  sort: number;
  options: PlanOption[];
}
export function groupPlans(rows: unknown[] | null | undefined): PlanCard[];
export function planName(card: PlanCard, lang: string): string;
export function perMonth(option: PlanOption): number | null;
