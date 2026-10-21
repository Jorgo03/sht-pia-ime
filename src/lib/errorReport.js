// Crash and error reporting, shared by the website and the phone app
// (docs/LAUNCH_TASKS.md F11). Reports go to the insert-only `client_errors`
// table; nobody can read them through the API, the owner reads them in the
// Supabase dashboard.
//
// Privacy, by construction:
//   * no user id, email, name or token is ever attached;
//   * messages and stacks are redacted here AND again by a database trigger
//     (same patterns, same order), so a missed case on one side is caught by
//     the other;
//   * the route is the path only: query strings and fragments can carry
//     search terms, tokens or ids.
// Reporting never throws and never retries: a crash report must not cause
// another crash or a request storm.

// Order matters: ids and tokens first, then phone numbers, whose pattern
// would otherwise eat the digit runs inside a UUID. Mirrors the trigger in
// supabase/migrations/20261021004604_client_errors_redact_ids_first.sql.
const SCRUB = [
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?/g,
  /(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g,
  /[Bb]earer\s+[A-Za-z0-9._~+/-]+=*/g,
  /\+?[0-9][0-9 ()-]{6,}[0-9]/g,
]

export const MAX_MESSAGE = 500
export const MAX_STACK = 4000
export const MAX_REPORTS_PER_SESSION = 10

/** Replace anything that could identify a person or unlock an account. */
export function redact(text) {
  let out = String(text ?? '')
  for (const re of SCRUB) out = out.replace(re, '<redacted>')
  return out
}

/** Path only, no query string or fragment, at most 200 characters. */
export function cleanRoute(route) {
  return String(route ?? '').split('#')[0].split('?')[0].slice(0, 200) || null
}

/** Short, stable id for "the same error": kind + message + top stack frame. */
export function fingerprint(kind, message, stack) {
  const top = String(stack ?? '').split('\n').find((line) => line.trim().startsWith('at ')) ?? ''
  const input = `${kind}|${message}|${top.trim()}`
  // FNV-1a, 32-bit: no crypto needed, only grouping.
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** The row to insert, or null when there is nothing worth sending. */
export function buildReport({ platform, appVersion, route, kind, error }) {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : (() => {
    try { return JSON.stringify(error) } catch { return String(error) }
  })()
  const message = redact(raw).trim().slice(0, MAX_MESSAGE)
  if (!message) return null
  const stack = error instanceof Error && error.stack ? redact(error.stack).slice(0, MAX_STACK) : null
  return {
    platform,
    app_version: appVersion ? String(appVersion).slice(0, 32) : null,
    route: cleanRoute(route),
    kind,
    message,
    stack,
    fingerprint: fingerprint(kind, message, stack),
  }
}

/**
 * One reporter per app. `enabled` should be false in development and in
 * tests, so a developer's console noise never lands in production data.
 */
export function createReporter({ client, platform, appVersion, enabled }) {
  const seen = new Set()
  let sent = 0
  return async function report(kind, error, route) {
    if (!enabled || sent >= MAX_REPORTS_PER_SESSION) return false
    try {
      const row = buildReport({ platform, appVersion, route, kind, error })
      if (!row || seen.has(row.fingerprint)) return false
      seen.add(row.fingerprint)
      sent++
      const { error: insertError } = await client.from('client_errors').insert(row)
      return !insertError
    } catch {
      return false
    }
  }
}
