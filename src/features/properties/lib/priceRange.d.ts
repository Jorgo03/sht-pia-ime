// Types for priceRange.js, so the phone app (TypeScript) can import it.
export const UNITS_PER_EUR: Readonly<Record<'EUR' | 'ALL' | 'USD', number>>;
export function priceRangeExpression(
  minEur: number | string | null | undefined,
  maxEur: number | string | null | undefined,
): string | null;
export function applyPriceRange<Q>(
  query: Q,
  range?: { minPrice?: number | string | null; maxPrice?: number | string | null },
): Q;
