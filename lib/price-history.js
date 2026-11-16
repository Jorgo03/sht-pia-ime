// Price history on a listing (DECISIONS.md W4): rows from
// public.property_price_history, oldest first. Pure, for tests.

/**
 * Steps worth showing: consecutive duplicates removed (a currency-only edit
 * back and forth, or the backfilled first row matching a later one), each
 * with its change from the step before. Fewer than two steps means the price
 * never changed, and the block is not shown.
 */
export function priceSteps(rows) {
  const sorted = [...(rows ?? [])]
    .filter((r) => r && Number.isFinite(Number(r.price)))
    .sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)));
  const steps = [];
  for (const r of sorted) {
    const prev = steps.at(-1);
    const price = Number(r.price);
    const currency = r.currency || 'EUR';
    if (prev && prev.price === price && prev.currency === currency) continue;
    const change = prev && prev.currency === currency && prev.price > 0 ? (price - prev.price) / prev.price : null;
    steps.push({ price, currency, changed_at: r.changed_at, change });
  }
  return steps;
}
