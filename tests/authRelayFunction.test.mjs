import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import handler from '../api/auth-relay.js'

// The Vercel function behind /auth/callback?rt=…: a server redirect to the
// phone's own address is what lets Android's Chrome open the app (a script on
// the page is refused), so Google sign-in in Expo Go no longer ends on the
// website. Same allow-list as the page.

function call(path) {
  const headers = {}
  const res = {
    statusCode: 200,
    setHeader: (k, v) => { headers[k.toLowerCase()] = v },
    end: () => {},
  }
  handler({ url: path }, res)
  return { status: res.statusCode, location: headers.location, headers }
}

const rt = (u) => encodeURIComponent(u)

test('an allowed app address gets a redirect straight to the app, carrying the code', () => {
  const lan = 'exp://192.168.0.8:8081/--/auth/callback'
  const r = call(`/api/auth-relay?rt=${rt(lan)}&code=abc123`)
  assert.equal(r.status, 302)
  assert.equal(r.location, `${lan}?code=abc123`)
  assert.equal(r.headers['cache-control'], 'no-store')
  assert.equal(r.headers['referrer-policy'], 'no-referrer')

  const tunnel = 'exps://c-jorgo03-t1zil1-mw5mtwkokmxdeuwu.on.expo.app/--/auth/callback'
  assert.equal(call(`/auth/callback?rt=${rt(tunnel)}&code=x`).location, `${tunnel}?code=x`)

  // A refusal from Google reaches the app too, so it can say so.
  assert.equal(
    call(`/auth/callback?rt=${rt(lan)}&error=access_denied&error_description=denied`).location,
    `${lan}?error=access_denied&error_description=denied`,
  )
})

test('any other address never receives the code: back to the page without rt', () => {
  for (const bad of [
    'https://evil.example/auth/callback',
    'exp://u-attacker-8081.exp.direct/--/auth/callback',
    'exp://8.8.8.8:8081/--/auth/callback',
    'javascript:alert(1)',
    'not a url',
  ]) {
    const r = call(`/auth/callback?rt=${rt(bad)}&code=abc`)
    assert.equal(r.status, 302, bad)
    assert.equal(r.location, '/auth/callback?code=abc', bad)
  }
  assert.equal(call('/auth/callback?rt=').location, '/auth/callback')
})

test('vercel.json sends only /auth/callback with rt to the function, before the page catch-all', () => {
  const { rewrites } = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.deepEqual(rewrites[0], {
    source: '/auth/callback',
    has: [{ type: 'query', key: 'rt' }],
    destination: '/api/auth-relay',
  })
  assert.equal(rewrites.at(-1).source, '/(.*)')
})
