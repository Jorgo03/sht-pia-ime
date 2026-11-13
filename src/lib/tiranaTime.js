// Viewing times are Tirana time on every device (AUDIT-005), shared by both
// apps (the phone app imports it through tiranaTime.d.ts). Pure, for `npm test`.
//
// A viewing happens at a home in Albania. Before, each device used its own
// zone: a buyer whose phone was set to London asked for 10:00 London time and
// the agent in Tirana saw 11:00. Now the picker means Tirana time, and every
// screen shows Tirana time, with a label when the device is elsewhere.
//
// Stored values stay timestamptz instants; only picking and showing change.

export const VIEWING_TIME_ZONE = 'Europe/Tirane'

// Built once. If an engine has no time-zone data (none of ours, but never
// crash at import for it), fall back to the device's own clock.
let PARTS = null
try {
  PARTS = new Intl.DateTimeFormat('en-US', {
    timeZone: VIEWING_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  if (typeof PARTS.formatToParts !== 'function') PARTS = null
} catch {
  PARTS = null
}

/** Tirana wall-clock parts of an instant. */
export function tiranaParts(date) {
  if (!PARTS) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() }
  }
  const out = {}
  for (const p of PARTS.formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  // Some ICU builds print midnight as 24 even with h23.
  if (out.hour === 24) out.hour = 0
  return out
}

/** Minutes Tirana is ahead of UTC at that instant (60 in winter, 120 in summer). */
export function tiranaOffsetMinutes(date) {
  const p = tiranaParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/** The instant at which Tirana's clock reads this date and time (month 1-12). */
export function fromTiranaWallTime(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = tiranaOffsetMinutes(new Date(guess))
  let t = guess - first * 60000
  const second = tiranaOffsetMinutes(new Date(t))
  if (second !== first) t = guess - second * 60000
  return new Date(t)
}

/**
 * For pickers that work in the device's own time (the native wheel, the
 * browser's datetime-local): a Date whose local clock reads the Tirana time
 * of `instant`, so the wheel shows what the agent will see.
 */
export function tiranaWallAsLocal(instant) {
  const p = tiranaParts(instant)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute)
}

/** The reverse: what the device-time picker shows, read as Tirana time. */
export function localWallAsTirana(local) {
  return fromTiranaWallTime(local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours(), local.getMinutes())
}

/** True when the device's clock already shows Tirana time at that instant. */
export function deviceUsesTiranaTime(instant = new Date()) {
  return -instant.getTimezoneOffset() === tiranaOffsetMinutes(instant)
}

/** Midnight in Tirana at the start of the Tirana day that contains `now`. */
export function tiranaDayStart(now = new Date()) {
  const p = tiranaParts(now)
  return fromTiranaWallTime(p.year, p.month, p.day, 0, 0)
}

const pad = (n) => String(n).padStart(2, '0')

/** "10:00" in Tirana, 24-hour as in Albania (same in every language). */
export function formatViewingClock(iso) {
  if (!iso) return ''
  const p = tiranaParts(new Date(iso))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** "20/11/2026 · 10:00" in Tirana (the apps' dd/mm/yyyy date format). */
export function formatViewingWhen(iso) {
  if (!iso) return ''
  const p = tiranaParts(new Date(iso))
  return `${pad(p.day)}/${pad(p.month)}/${p.year} · ${formatViewingClock(iso)}`
}
