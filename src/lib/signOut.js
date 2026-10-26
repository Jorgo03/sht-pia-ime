// Sign-out for both apps; each passes its own Supabase client.
//
// auth-js keeps the stored session when /logout fails for any reason other
// than 401/403/404: offline, a timeout, or a 5xx while the free-tier project is
// paused. The app showed the signed-out screen, but the session was still in
// storage, so the account came back on the next launch, or with the next token
// refresh. On a shared phone that hands the next person the previous account.
// The person asked to sign out, so this device forgets the session either way;
// revoking it on the server is best effort.

/** Signs out, and makes sure this device forgets the session. */
export async function signOutOfDevice(client) {
  const { error } = await client.auth.signOut()
  if (error) {
    try {
      // What signOut() runs itself after a successful /logout: removes the
      // stored session and its PKCE verifier, then emits SIGNED_OUT.
      // tests/signOut.test.mjs fails if an auth-js upgrade drops it.
      await client.auth._removeSession()
    } catch (removeError) {
      return { error: removeError }
    }
  }
  return { error: error ?? null }
}
