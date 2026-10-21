// Types for searchFilters.js, so the phone app (TypeScript) can import it.
export function zonesFor(city: string | null | undefined): string[];
export function validZone(city: string | null | undefined, zone: string | null | undefined): string | null;
export function formatRef(refCode: string | null | undefined): string;
export function normalizeRef(input: string | null | undefined): string | null;
export function applyZoneAndRef<Q>(
  query: Q,
  filters?: { city?: string | null; zone?: string | null; ref?: string | null },
): Q;
