// Pure classifier for supabase.auth.onAuthStateChange events, split out of
// AuthContext.jsx so the event-routing decision is unit-testable without a
// live Supabase client or React — and so it's structurally provable that
// classifying an event performs no Supabase API calls itself (no imports,
// no I/O; it only inspects its two arguments and returns a plain object).
// AuthContext.jsx is responsible for acting on the returned descriptor
// (calling sync(), setState(), etc.) — this function never does.
//
// action:
//   'sync'          — hydrate session+profile for this session (or clear
//                      state if session is null/absent, same as before)
//   'sync-welcome'   — sync, and also show the welcome toast if a pending-
//                      welcome flag is set (only ever true for a genuine new
//                      OAuth sign-in, not a restored session — see below)
//   'clear'          — sign-out: clear state immediately, no session to sync
//   'none'           — event carries nothing actionable
export function classifyAuthEvent(event, session) {
  switch (event) {
    case 'PASSWORD_RECOVERY':
      // A real, valid session — just not an ordinary sign-in. AuthContext
      // sets passwordRecovery so Profile.jsx shows the new-password form
      // instead of the signed-in dashboard.
      return { action: 'sync', passwordRecovery: true }
    case 'SIGNED_IN':
      // supabase-js replays SIGNED_IN whenever it restores a persisted
      // session from storage on page load — not just on a genuine new
      // sign-in — and it fires that replay *before* INITIAL_SESSION, so
      // event ordering alone can't distinguish the two. Only OAuth reaches
      // 'sync-welcome' in practice (password/OTP call showWelcome directly
      // on success instead); AuthContext still gates the actual toast on
      // the flag signInWithProvider sets right before the redirect.
      return session?.user ? { action: 'sync-welcome' } : { action: 'none' }
    case 'TOKEN_REFRESHED':
      return session ? { action: 'sync' } : { action: 'none' }
    case 'USER_UPDATED':
      // Fires after supabase.auth.updateUser() — today only the
      // password-recovery completion path calls that, and changing a
      // password rotates the session's tokens. Previously this fell through
      // to 'none', so the context kept the superseded session object. No
      // call site reads session.access_token directly (everything goes
      // through the supabase client, which tracks the new token itself), so
      // nothing broke — but the context's own `user`/`session` were stale,
      // and would be visibly wrong the moment an email change is added.
      return session ? { action: 'sync' } : { action: 'none' }
    case 'SIGNED_OUT':
      return { action: 'clear', passwordRecovery: false }
    case 'INITIAL_SESSION':
      return { action: 'sync' }
    default:
      return { action: 'none' }
  }
}
