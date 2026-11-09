// The notification centre's rules: what a notification says and where tapping
// it goes. Pure, for `npm test`; the phone app imports it through feed.d.ts.
// The database stores only the kind and ids, so the words are always in the
// reader's current language.

const UUID = /^[0-9a-f-]{36}$/

/** Where tapping goes, or null to stay on the notifications screen. */
export function notificationRoute(n) {
  const data = n?.data ?? {}
  switch (n?.kind) {
    case 'message':
    case 'inquiry':
      return UUID.test(data.conversation_id ?? '') ? `/messages/${data.conversation_id}` : null
    case 'viewing_requested':
    case 'viewing_updated':
      return '/viewings'
    case 'listing_hidden':
    case 'listing_restored':
      return UUID.test(data.property_id ?? '') ? `/property/${data.property_id}` : null
    case 'saved_search':
      return UUID.test(data.property_id ?? '') ? `/property/${data.property_id}` : '/saved-searches'
    default:
      return null
  }
}

/** The title and body, through the app's own translate function. */
export function notificationCopy(n, t) {
  const data = n?.data ?? {}
  const key = (k) => `notifications.kinds.${n.kind}.${k}`
  const name = data.sender_name
  switch (n?.kind) {
    case 'announcement':
      return { title: data.title ?? '', body: data.body ?? '' }
    case 'message': {
      const count = Number(data.count) || 1
      const body = name
        ? count > 1 ? t(key('bodyMany'), { name, total: count }) : t(key('body'), { name })
        : t(key('bodyNoName'))
      return { title: t(key('title')), body }
    }
    case 'saved_search': {
      const total = Number(data.count) || 1
      return { title: t(key('title')), body: total > 1 ? t(key('bodyMany'), { total }) : t(key('body')) }
    }
    case 'inquiry':
      return { title: t(key('title')), body: name ? t(key('body'), { name }) : t(key('bodyNoName')) }
    case 'viewing_updated': {
      const status = ['confirmed', 'declined', 'cancelled'].includes(data.status) ? data.status : 'updated'
      return { title: t(key('title')), body: t(key(status)) }
    }
    default:
      return { title: t(key('title')), body: t(key('body')) }
  }
}

/** The conversation a pathname is showing, or null. */
export function conversationInPath(pathname) {
  const m = /^\/messages\/([0-9a-f-]{36})$/.exec(pathname ?? '')
  return m ? m[1] : null
}

/**
 * Whether a live change should pop up a banner: unread, and only just
 * created (a realtime replay or an older row must not), and not about the
 * conversation already on screen.
 */
export function shouldBanner(n, { pathname, now = Date.now(), prefs } = {}) {
  if (!n || n.read_at) return false
  if (now - new Date(n.created_at).getTime() > 30_000) return false
  const conv = n.data?.conversation_id
  if (conv && conversationInPath(pathname) === conv) return false
  if (prefs) {
    if ((n.kind === 'message' || n.kind === 'inquiry') && prefs.messages === false) return false
    if ((n.kind === 'viewing_requested' || n.kind === 'viewing_updated') && prefs.viewings === false) return false
  }
  return true
}
