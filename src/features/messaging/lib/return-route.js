// Where Messages sends the user back — shared by the phone app's Messages
// inbox and thread so both leave the same way (Home/Search/Profile aware,
// history-aware, deep-link safe).
//
// Messages lives outside the Tabs navigator: a stack push on top of
// (tabs). The Tabs underneath stay mounted, so a plain router.back() pops
// back to the exact tab the person came from with its scroll and filter
// state intact — on Android (hardware back) and iOS (swipe/chevron) alike.
// That pop is the primary return. The token below is only the fallback for
// the cases where there is nothing to pop: a deep link, a notification
// cold start, or a direct web load of /messages. In those the back arrow
// replaces to the remembered tab (or the Tabs root — never a hardcoded
// Home redirect — so the Tabs navigator shows its active tab).

export const MESSAGES_RETURN_TOKEN = Object.freeze({
  HOME: 'home',
  SEARCH: 'search',
  PROFILE: 'profile',
  AGENT: 'agent',
})

export const MESSAGES_RETURN_TOKENS = Object.freeze([
  MESSAGES_RETURN_TOKEN.HOME,
  MESSAGES_RETURN_TOKEN.SEARCH,
  MESSAGES_RETURN_TOKEN.PROFILE,
  MESSAGES_RETURN_TOKEN.AGENT,
])

// Tabs-root fallback: the (tabs) group itself, not (tabs)/index. With no
// history the Tabs navigator shows its active tab instead of resetting to
// Home — Home only when the person really started there (cold start).
export const MESSAGES_RETURN_FALLBACK = '/(tabs)'

const TOKEN_TO_ROUTE = Object.freeze({
  [MESSAGES_RETURN_TOKEN.HOME]: '/(tabs)',
  [MESSAGES_RETURN_TOKEN.SEARCH]: '/(tabs)/explore',
  [MESSAGES_RETURN_TOKEN.PROFILE]: '/(tabs)/profile',
  [MESSAGES_RETURN_TOKEN.AGENT]: '/agent-dashboard',
})

// Full routes and pathnames also accepted as a `from` value, for callers
// that hold a pathname (LiquidTabBar holds the tab name; the profile menu
// and agent dashboard hold their own route) rather than a short token.
const ROUTE_TO_TOKEN = Object.freeze({
  '/': MESSAGES_RETURN_TOKEN.HOME,
  '/(tabs)': MESSAGES_RETURN_TOKEN.HOME,
  '/(tabs)/index': MESSAGES_RETURN_TOKEN.HOME,
  '/home': MESSAGES_RETURN_TOKEN.HOME,
  '/explore': MESSAGES_RETURN_TOKEN.SEARCH,
  '/(tabs)/explore': MESSAGES_RETURN_TOKEN.SEARCH,
  '/search': MESSAGES_RETURN_TOKEN.SEARCH,
  '/profile': MESSAGES_RETURN_TOKEN.PROFILE,
  '/(tabs)/profile': MESSAGES_RETURN_TOKEN.PROFILE,
  '/agent-dashboard': MESSAGES_RETURN_TOKEN.AGENT,
  '/agent': MESSAGES_RETURN_TOKEN.AGENT,
})

/** True for one of the four short origin tokens. */
export function isMessagesReturnToken(value) {
  return typeof value === 'string' && MESSAGES_RETURN_TOKENS.includes(value)
}

/** A Tabs route name ('index' | 'explore' | 'profile') to its origin token. */
export function tokenForTab(tabName) {
  if (tabName === 'explore') return MESSAGES_RETURN_TOKEN.SEARCH
  if (tabName === 'profile') return MESSAGES_RETURN_TOKEN.PROFILE
  // 'index' is Home; anything unknown lands on Home rather than guessing a
  // tab that does not exist.
  return MESSAGES_RETURN_TOKEN.HOME
}

/** An origin token to the route leaving Messages should replace to. */
export function returnRouteForToken(token) {
  return TOKEN_TO_ROUTE[token] ?? MESSAGES_RETURN_FALLBACK
}

/**
 * Normalise the raw `from` search param — a token, a route, an array
 * (repeated ?from=) or garbage — to a known token, or null when it is not
 * one. Callers resolve null to the Tabs root, so a crafted value cannot
 * steer the app off-stack (no external URLs, no /messages loops, no
 * absolute-path surprises).
 */
export function parseReturnToken(param) {
  const raw = Array.isArray(param) ? param[0] : param
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (isMessagesReturnToken(value)) return value
  return ROUTE_TO_TOKEN[value] ?? null
}

/** The /messages href that remembers `token` (or plain /messages). */
export function buildInboxHref(token) {
  const parsed = parseReturnToken(token)
  if (!parsed) return '/messages'
  return `/messages?from=${encodeURIComponent(parsed)}`
}

/**
 * The thread href for an inbox row, carrying `token` forward so the
 * thread's own fallback can still land on the origin tab if the thread
 * was cold-started or its history was lost.
 */
export function buildThreadHref(conversationId, token) {
  const parsed = parseReturnToken(token)
  const base = `/messages/${conversationId}`
  if (!parsed) return base
  return `${base}?from=${encodeURIComponent(parsed)}`
}

/**
 * The safe way out of Messages: pop when there is history (preserves the
 * exact tab, scroll and state underneath), replace to the remembered tab
 * when there is not. Pure, so both screens share one decision and it is
 * testable without a router.
 */
export function resolveGoBackAction({ canGoBack, from }) {
  const token = parseReturnToken(from)
  if (canGoBack) return { kind: 'back', token }
  return { kind: 'replace', token, href: returnRouteForToken(token) }
}
