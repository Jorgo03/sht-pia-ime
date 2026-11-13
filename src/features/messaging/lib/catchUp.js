// Catching up after realtime misses rows, shared by both apps (the phone app
// imports it through catchUp.d.ts). Pure, for `npm test`.
//
// Supabase Realtime's postgres_changes does not replay what happened while a
// channel was down (lost connection, phone asleep, app in the background).
// A thread left open showed nothing new until it was reopened (AUDIT-024).
// The caller re-reads when the channel subscribes again after its first time,
// and when the app returns to the foreground.

export function createCatchUp(onCatchUp) {
  let subscribedOnce = false
  let lastAppState = 'active'
  return {
    onStatus(status) {
      if (status !== 'SUBSCRIBED') return
      if (subscribedOnce) onCatchUp()
      subscribedOnce = true
    },
    onAppState(next) {
      const was = lastAppState
      lastAppState = next
      if (next === 'active' && was !== 'active') onCatchUp()
    },
  }
}

/** Every message once (by id), oldest first. */
export function mergeMessages(prev, fresh) {
  const byId = new Map()
  for (const m of prev ?? []) byId.set(m.id, m)
  for (const m of fresh ?? []) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
}
