// Price display currency (DECISIONS.md W4). Rates are units per 1 EUR, as
// stored in public.exchange_rates. Pure, shared by the app and the tests.

/** Currencies a visitor can show prices in, after "as listed" (null). */
export const DISPLAY_CURRENCIES = ['ALL', 'EUR', 'USD', 'GBP'];

export const isDisplayCurrency = (c) => typeof c === 'string' && DISPLAY_CURRENCIES.includes(c);

/**
 * `amount` in `from` converted to `to`, or null when it cannot be (unknown
 * currency or no rate yet). Same currency returns the amount unchanged.
 */
export function convertAmount(amount, from, to, rates) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const src = (from || 'EUR').toUpperCase();
  const dst = (to || src).toUpperCase();
  if (src === dst) return value;
  const fromRate = src === 'EUR' ? 1 : Number(rates?.[src]);
  const toRate = dst === 'EUR' ? 1 : Number(rates?.[dst]);
  if (!(fromRate > 0) || !(toRate > 0)) return null;
  return (value / fromRate) * toRate;
}

/**
 * Rounds a converted price so it does not look more exact than a daily rate
 * is: whole units under 1,000, then to 3 significant figures.
 */
export function roundConverted(value) {
  if (!Number.isFinite(value)) return value;
  const abs = Math.abs(value);
  if (abs < 1000) return Math.round(value);
  const step = 10 ** (Math.floor(Math.log10(abs)) - 2);
  return Math.round(value / step) * step;
}

/** { ALL: 98.7, ... } from exchange_rates rows. */
export const ratesMap = (rows) =>
  Object.fromEntries((rows ?? []).filter((r) => r && Number(r.per_eur) > 0).map((r) => [String(r.currency), Number(r.per_eur)]));
