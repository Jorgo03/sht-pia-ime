// Sign-out: stop this device getting the account's pushes (lib/push.ts
// forgetDevice). Pure, for `npm test`.
//
// The device's own record of its token is cleared only after the server row
// is gone. supabase-js reports a failed delete as { error } rather than
// throwing, and the old code cleared the record either way: offline, the row
// stayed, the phone forgot the token, and no later sign-out could remove it,
// so the old account's pushes kept arriving. Now a failure keeps the record,
// and the next online sign-out deletes the row.

/**
 * Returns 'removed', 'kept' (the server delete failed; the record stays) or
 * 'none' (nothing registered on this device).
 */
export async function forgetToken({ readToken, deleteRow, clearToken, retryDelayMs = 1500, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const token = await readToken().catch(() => null)
  if (!token) return 'none'
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await wait(retryDelayMs)
    const ok = await deleteRow(token).then(
      (res) => !res?.error,
      () => false,
    )
    if (ok) {
      await clearToken().catch(() => {})
      return 'removed'
    }
  }
  return 'kept'
}
