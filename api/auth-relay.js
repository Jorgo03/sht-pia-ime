// Mobile sign-in relay, server side (Vercel function).
//
// vercel.json rewrites /auth/callback?rt=… here. Supabase sends Google's
// result to that allow-listed page with the phone's own address in `rt`
// (Expo Go's exp://… cannot be allow-listed). The page used to hand the code
// on with a script, but Android's Chrome refuses a scripted jump to an app
// link from a freshly loaded page, so the person was left on the website
// looking at an "Open the app" button (Samsung, 2026-11-07).
//
// A redirect from the server is different: it continues the redirect chain
// that started with the person's tap on their Google account, and Chrome lets
// that chain open the app. This is how Expo's old auth proxy returned to
// exp:// too.
//
// Which addresses may receive the code is the same security boundary as the
// page (src/lib/oauthRelay.js): an open redirect carrying an authorization
// code hands over the account. Anything that is not an allowed app address
// goes back to the page without `rt`, exactly as if no relay was asked for.

import { buildRelayTarget } from '../src/lib/oauthRelay.js'

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'https://relay.invalid')
  const target = buildRelayTarget(url.search, '')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (target) {
    res.statusCode = 302
    res.setHeader('Location', target)
    res.end()
    return
  }
  const params = new URLSearchParams(url.search)
  params.delete('rt')
  const rest = params.toString()
  res.statusCode = 302
  res.setHeader('Location', `/auth/callback${rest ? `?${rest}` : ''}`)
  res.end()
}
