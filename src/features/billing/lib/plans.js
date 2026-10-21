// Price list for the website's pricing page (docs/LAUNCH_TASKS.md F15).
// Reads public.plans, which is public and empty until the owner sets prices.
// Works with both plan shapes: the current one and the pending
// tier/period_months one (supabase/pending/plans_by_period_months.sql).

/** Group plan rows into cards: one per (kind, tier), each with its periods. */
export function groupPlans(rows) {
  const groups = new Map()
  for (const row of rows ?? []) {
    if (!row || row.active === false) continue
    const tier = row.tier ?? row.id
    const key = `${row.kind}:${tier}`
    if (!groups.has(key)) groups.set(key, { key, kind: row.kind, tier, name: row.name_i18n ?? {}, listingCap: row.listing_cap ?? null, credits: row.promotion_credits ?? 0, sort: row.sort_order ?? 0, options: [] })
    groups.get(key).options.push({ id: row.id, months: row.period_months ?? null, priceCents: row.price_cents, currency: row.currency ?? 'EUR' })
  }
  const cards = [...groups.values()]
  for (const c of cards) c.options.sort((a, b) => (a.months ?? 0) - (b.months ?? 0))
  return cards.sort((a, b) => a.sort - b.sort || (a.kind === b.kind ? 0 : a.kind === 'agency_subscription' ? -1 : 1))
}

/** Localised plan name, falling back to Albanian, then the tier id. */
export function planName(card, lang) {
  return card.name?.[lang] || card.name?.sq || card.tier
}

/** Price per month for a period, in minor units (for "≈ N / month"). */
export function perMonth(option) {
  return option.months ? Math.round(option.priceCents / option.months) : null
}
