// Raporti im: the arithmetic behind the agent performance report
// (docs/PERFORMANCE_REPORT.md). Pure functions, no I/O, so the period
// boundaries, averages and comparisons are unit-tested (tests/performanceReport.test.mjs).
// The counts themselves come from the my_performance_report() database function.

/** Reporting periods offered on the screen, in display order. */
export const PERIODS = ['week', 'month', '3m', '6m', 'year', 'all', 'custom']

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * `[from, to)` for a period, in the device's own time zone.
 * `null` means unbounded: "all time" has neither end, every preset runs to now.
 * A custom range covers whole days: from the start of `custom.from` to the end
 * of `custom.to`. Returns null for a custom range that is missing or backwards.
 */
export function periodRange(period, now = new Date(), custom) {
  const today = startOfDay(now)
  switch (period) {
    case 'week': {
      // Weeks start on Monday, as in Albania and most of Europe.
      const back = (today.getDay() + 6) % 7
      return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - back), to: null }
    }
    case 'month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: null }
    case '3m':
      return { from: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), to: null }
    case '6m':
      return { from: new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()), to: null }
    case 'year':
      return { from: new Date(today.getFullYear(), 0, 1), to: null }
    case 'all':
      return { from: null, to: null }
    case 'custom': {
      if (!custom || !custom.from || !custom.to) return null
      const from = startOfDay(custom.from)
      const lastDay = startOfDay(custom.to)
      const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1)
      return from < to ? { from, to } : null
    }
    default:
      return null
  }
}

const DAYS_PER_MONTH = 365.25 / 12

/** Months the agent has used the app, never less than one. */
export function monthsActive(since, now = new Date()) {
  const start = since instanceof Date ? since : new Date(since)
  if (Number.isNaN(start.getTime())) return 1
  const days = (now.getTime() - start.getTime()) / 86_400_000
  return Math.max(1, days / DAYS_PER_MONTH)
}

const round1 = (n) => Math.round(n * 10) / 10

/**
 * One before/after row. `previous` is the agent's own estimate (null when not
 * entered); `current` is the recorded monthly average. The percentage is null
 * when there is nothing to compare against (no estimate, or an estimate of 0).
 */
export function compareToBaseline(previous, total, months) {
  const current = round1(total / Math.max(1, months))
  if (previous === null || previous === undefined || previous === '' || Number.isNaN(Number(previous))) {
    return { previous: null, current, difference: null, percent: null }
  }
  const prev = Number(previous)
  const difference = round1(current - prev)
  // Halves round away from zero, so a fall reads as large as the same rise.
  const raw = prev > 0 ? ((current - prev) / prev) * 100 : null
  const percent = raw === null ? null : Math.sign(raw) * Math.round(Math.abs(raw))
  return { previous: prev, current, difference, percent }
}

/**
 * Parses one estimate typed by the agent: empty means "not entered" (null);
 * otherwise a number from 0 to 1000 with at most two decimals, comma or point.
 * Returns undefined for anything else, so the form can refuse it.
 */
export function parseEstimate(text) {
  const s = String(text ?? '').trim().replace(',', '.')
  if (s === '') return null
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return undefined
  const n = Number(s)
  return n <= 1000 ? n : undefined
}

/** Private milestones, from the agent's own all-time counts. */
export function achievements(totals) {
  const t = {
    listings: Number(totals?.listings) || 0,
    transactions: Number(totals?.transactions) || 0,
    viewings: Number(totals?.viewings) || 0,
  }
  return [
    { key: 'firstListing', target: 1, value: t.listings },
    { key: 'firstTransaction', target: 1, value: t.transactions },
    { key: 'tenListings', target: 10, value: t.listings },
    { key: 'tenViewings', target: 10, value: t.viewings },
    { key: 'tenTransactions', target: 10, value: t.transactions },
  ].map((a) => ({ ...a, done: a.value >= a.target, progress: Math.min(a.value, a.target) }))
}

/** The last `count` months of the monthly series, oldest first. */
export function recentMonths(monthly, count = 12) {
  return Array.isArray(monthly) ? monthly.slice(-count) : []
}
