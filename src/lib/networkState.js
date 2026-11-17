// Whether the device can reach the network, from a NetInfo state (phones
// only; imported through networkState.d.ts). Pure, for `npm test`.
//
// Only a definite "no" counts as offline: right after start-up NetInfo reports
// null for both fields, and treating that as offline would pause every query
// on launch (AUDIT-009).
export function isOnline(state) {
  if (!state) return true
  if (state.isConnected === false) return false
  if (state.isInternetReachable === false) return false
  return true
}
