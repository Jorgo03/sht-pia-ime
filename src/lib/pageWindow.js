// Paged lists, shared by both apps (the phone app imports it through
// pageWindow.d.ts). Pure, for `npm test`.
//
// A screen asks for `limit + 1` rows and shows `limit`; the extra row only
// says whether "Load more" has anything to load (AUDIT-015). "Load more"
// raises the limit by LIST_PAGE_SIZE, so a reload (realtime, focus) keeps
// what is on screen.
export const LIST_PAGE_SIZE = 24

export function pageWindow(rows, limit) {
  const list = rows ?? []
  return { items: list.slice(0, limit), hasMore: list.length > limit }
}
