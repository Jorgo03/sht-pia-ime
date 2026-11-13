// Where the phone app opens (owner, 2026-11-13): someone who is not signed in
// starts on the sign-in screen, not on Home. Pure, for `npm test`; the phone
// app imports it through startScreen.d.ts.
//
// Only a plain launch is redirected: the app opening on Home. A notification
// or a link into a listing or a chat opens what it points at. The website is
// left alone: visitors and search engines land on Home and its listings.
//
// The sign-in screen then offers "Browse without an account": Apple refuses
// apps that make people sign in before they can use features that need no
// account (App Review Guideline 5.1.1(v)), and browsing homes needs none.

/** The search parameter that marks the sign-in screen as the app's first screen. */
export const START_PARAM = 'start'

/** True when this launch should open on the sign-in screen. */
export function shouldStartOnSignIn({ platform, signedIn, pathname }) {
  if (platform === 'web' || signedIn) return false
  return pathname === '/' || pathname === '' || pathname == null
}

/** True when the sign-in screen was opened as the app's first screen. */
export function openedAtLaunch(value) {
  return (Array.isArray(value) ? value[0] : value) === '1'
}
