// Home's "by city" and "agencies" rails. Pure, for `npm test`; the phone app
// imports it through discovery.d.ts.

/** The cities offered as tiles. Each is one small query, so the list is short. */
export const HIGHLIGHT_CITIES = ['Tiranë', 'Durrës', 'Vlorë', 'Sarandë', 'Shkodër', 'Korçë', 'Elbasan', 'Fier']

/** Only cities with homes, the fullest first; ties keep the list's own order. */
export function rankCityTiles(tiles) {
  return tiles
    .map((tile, order) => ({ tile, order }))
    .filter(({ tile }) => tile.count > 0)
    .sort((a, b) => b.tile.count - a.tile.count || a.order - b.order)
    .map(({ tile }) => tile)
}

/** Live listings per agent, from `{ agent_id }` rows, most listings first. */
export function tallyAgents(rows) {
  const counts = new Map()
  for (const { agent_id: id } of rows ?? []) {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts].map(([id, listings]) => ({ id, listings })).sort((a, b) => b.listings - a.listings)
}

/**
 * Directory rows: the agency's name leads, the person's name follows. Someone
 * whose profile cannot be read, or who has no name at all, is left out.
 */
export function joinAgents(tally, profiles) {
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
  return tally.flatMap(({ id, listings }) => {
    const profile = byId.get(id)
    const person = profile?.full_name?.trim() || null
    const agency = profile?.agency_name?.trim() || null
    const title = agency || person
    if (!title) return []
    return [{ id, title, subtitle: agency && person && agency !== person ? person : null, avatar: profile.avatar_url ?? null, listings }]
  })
}

/** Case- and accent-insensitive: "korce" finds "Korçë". */
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function filterAgents(agents, query) {
  const q = fold(query).trim()
  if (!q) return agents
  return agents.filter((a) => fold(a.title).includes(q) || fold(a.subtitle).includes(q))
}

/** Up to two initials, whole characters only, for a missing photo. */
export function initialsOf(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('')
}
