import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { buildRelayTarget, isAllowedRelayTarget, isAppCallback } from '../src/lib/oauthRelay.js'

// The mobile sign-in relay forwards a Google sign-in code to the address in
// ?rt=. An open relay is an account takeover, so only the app's own callback
// on a private network, or its own scheme, may receive it.

const ALLOWED = [
  'exp://192.168.1.20:8081/--/auth/callback', // home Wi-Fi
  'exp://10.0.0.5:8081/--/auth/callback',
  'exp://172.20.10.3:8081/--/auth/callback', // iPhone hotspot
  'exp://127.0.0.1:8081/--/auth/callback',
  'exp://localhost:8081/--/auth/callback',
  'shtepia-ime://auth/callback', // dev-client and store builds
]
const REFUSED = [
  'exp://u-attacker-8081.exp.direct/--/auth/callback', // Expo tunnel: anyone can register one
  'exp://evil.example:8081/--/auth/callback',
  'exp://8.8.8.8:8081/--/auth/callback', // public address
  'exp://172.32.0.1:8081/--/auth/callback', // just outside 172.16/12
  'exp://192.169.1.1:8081/--/auth/callback',
  'exp://192.168.1.999:8081/--/auth/callback',
  'exp://192.168.1.20:8081/--/somewhere-else', // wrong path
  'exp://user:pw@192.168.1.20:8081/--/auth/callback',
  'shtepia-ime://other/callback',
  'https://evil.example/auth/callback',
  'javascript:alert(1)',
]

test('only the app callback on a private network, or the app scheme, is allowed', () => {
  for (const u of ALLOWED) assert.equal(isAppCallback(new URL(u)), true, u)
  for (const u of REFUSED) assert.equal(isAppCallback(new URL(u)), false, u)
  assert.equal(isAllowedRelayTarget('not a url'), false)
  assert.equal(isAllowedRelayTarget(undefined), false)
})

test('the forwarded address carries the code and drops rt', () => {
  const app = 'exp://192.168.1.20:8081/--/auth/callback'
  assert.equal(buildRelayTarget(`?rt=${encodeURIComponent(app)}&code=abc`, ''), `${app}?code=abc`)
  assert.equal(buildRelayTarget(`?rt=${encodeURIComponent(app)}&error=access_denied`, ''), `${app}?error=access_denied`)
  assert.equal(buildRelayTarget('?code=abc', ''), null)
  assert.equal(buildRelayTarget(`?rt=${encodeURIComponent('exp://x.exp.direct/--/auth/callback')}&code=abc`, ''), null)
})

// The inline copies run before the app's bundle, so they cannot import the module.
function inlineCheck(file, unescape) {
  let src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const start = src.indexOf('function isAppCallback(u) {')
  assert.ok(start > 0, `${file} has the inline check`)
  let depth = 0
  let end = start
  for (; end < src.length; end++) {
    if (src[end] === '{') depth++
    if (src[end] === '}' && --depth === 0) break
  }
  let fn = src.slice(start, end + 1)
  if (unescape) fn = fn.replace(/\\\\/g, '\\') // template literal in a .tsx file
  return vm.runInNewContext(`(${fn})`)
}

test('the inline copies in index.html and app/+html.tsx give the same answers', () => {
  for (const [file, unescape] of [['index.html', false], ['app/+html.tsx', true]]) {
    const check = inlineCheck(file, unescape)
    for (const u of [...ALLOWED, ...REFUSED]) assert.equal(check(new URL(u)), isAppCallback(new URL(u)), `${file}: ${u}`)
  }
})
