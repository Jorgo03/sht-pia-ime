// Which message a refused viewing request shows, shared by both apps (the
// phone app imports it through viewingErrors.d.ts). Pure, for `npm test`.
//
// 23P01: another open viewing already holds that time, at this listing or
//        with this agent (migration 20261113194212, AUDIT-003).
// 23514: the time is in the past (guard_viewing_insert / guard_viewing_update).
export function viewingRequestErrorKey(error) {
  if (error?.code === '23P01') return 'viewings.slotTaken'
  if (error?.code === '23514') return 'viewings.pastDate'
  return 'viewings.requestFailed'
}
