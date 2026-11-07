// Extra query parameters for a provider sign-in, shared by both apps (the
// phone app imports it through oauthOptions.d.ts). Pure, for `npm test`.
//
// Google: prompt=select_account shows Google's account chooser every time,
// instead of silently reusing the account already signed in on the device
// or browser. Only the chooser: not prompt=consent, which forced Google's
// permission screen on every sign-in and could hang on a blank page (see
// src/features/auth/AuthContext.jsx), and no access_type=offline (the app
// never calls Google APIs, Supabase keeps its own session).
//
// Choosing an account changes nothing about who it is: Supabase matches the
// Google identity to the same user as before, so no duplicate account.
export function oauthQueryParams(provider) {
  if (provider === 'google') return { prompt: 'select_account' }
  return undefined
}
