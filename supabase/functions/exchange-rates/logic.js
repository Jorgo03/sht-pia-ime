// Pure part of the exchange-rates function, so tests/currency.test.mjs can
// check it. The source answers with units per 1 EUR for every currency.

export const CURRENCIES = ['ALL', 'EUR', 'USD', 'GBP'];

// Plausible bounds per 1 EUR, wide enough for years of normal movement. A
// value outside them is a broken response, not a rate, and is not stored.
const BOUNDS = { ALL: [50, 250], EUR: [1, 1], USD: [0.5, 2], GBP: [0.4, 1.5] };

/** Rows to upsert from the source's JSON, or an error string. */
export function ratesFromResponse(body, now = new Date()) {
  if (!body || body.result !== 'success' || body.base_code !== 'EUR' || typeof body.rates !== 'object') {
    return { error: 'unexpected response' };
  }
  const rows = [];
  for (const currency of CURRENCIES) {
    const value = currency === 'EUR' ? 1 : Number(body.rates[currency]);
    const [lo, hi] = BOUNDS[currency];
    if (!Number.isFinite(value) || value < lo || value > hi) return { error: `implausible ${currency} rate` };
    rows.push({ currency, per_eur: value, source: 'open.er-api.com', updated_at: now.toISOString() });
  }
  return { rows };
}
