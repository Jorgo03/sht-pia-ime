// Turns text into something safe to place inside HTML markup or an attribute.
// React escapes on its own; this is for the few places a string of HTML is
// built by hand (Leaflet marker icons). tests/xssAndQueries.test.mjs fails if
// a new hand-built HTML string skips it.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch])
}
