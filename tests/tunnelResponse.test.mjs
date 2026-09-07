import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { classifyTunnelResponse } = require('../scripts/expo-tunnel-qr.cjs')

/**
 * scripts/expo-tunnel-qr.cjs refuses to draw a QR until the public tunnel host
 * is genuinely serving. This is that judgement, and it is the only thing
 * standing between the developer and a code that scans perfectly then fails on
 * the phone — so a permissive mistake here reintroduces exactly the bug the
 * script was written to remove.
 *
 * The case that matters is ngrok's "registered but nothing connected" reply:
 * a well-formed HTTP response carrying ERR_NGROK_3200. Status alone cannot
 * catch it, which is why the body is inspected too.
 */

test('a serving tunnel is accepted', () => {
  const { ok } = classifyTunnelResponse({ status: 200, body: '{"id":"manifest"}' })
  assert.equal(ok, true)
})

test('ngrok ERR_NGROK_3200 is rejected even though it is a valid response', () => {
  const body =
    '<html><body><h2>The endpoint ffuyfm8-jorgo03-8081.exp.direct is offline.</h2>' +
    '<p>ERR_NGROK_3200</p></body></html>'
  const verdict = classifyTunnelResponse({ status: 404, body })
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /nothing is connected/)
})

test('ERR_NGROK_3200 is rejected even when served with a 200', () => {
  // Defensive: the check must not rest on the status code alone, since a proxy
  // or captive portal can rewrite the status while preserving the body.
  const { ok } = classifyTunnelResponse({ status: 200, body: 'ERR_NGROK_3200' })
  assert.equal(ok, false)
})

test('no response at all is rejected', () => {
  const verdict = classifyTunnelResponse({ status: null, body: '' })
  assert.equal(verdict.ok, false)
  assert.equal(verdict.reason, 'no response')
})

test('other server errors are rejected and reported with their status', () => {
  const verdict = classifyTunnelResponse({ status: 502, body: 'bad gateway' })
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /502/)
})

test('a missing body does not throw', () => {
  // res.on('data') may never fire; the classifier must still return a verdict
  // rather than crashing the poll loop.
  assert.equal(classifyTunnelResponse({ status: 200, body: undefined }).ok, true)
})

test('requiring the script does not start a dev server', () => {
  // The CLI half is guarded behind require.main. If that guard regressed,
  // importing this module would spawn Expo — and the test run would hang.
  const mod = require('../scripts/expo-tunnel-qr.cjs')
  assert.equal(typeof mod.classifyTunnelResponse, 'function')
  assert.equal(typeof mod.tunnelHostname, 'function')
})

const { parseNgrokTunnels } = require('../scripts/expo-tunnel-qr.cjs')

/**
 * The ngrok agent's own API is the authoritative source for the live tunnel
 * address — better than deriving it from the project's stored randomness and
 * the account name, which goes stale if that randomness is reset after a
 * collision. These cover the shapes the agent actually returns.
 */

test('prefers the https tunnel over the http one', () => {
  const json = JSON.stringify({
    tunnels: [
      { public_url: 'http://ffuyfm8-jorgo03-8081.exp.direct' },
      { public_url: 'https://ffuyfm8-jorgo03-8081.exp.direct' },
    ],
  })
  assert.equal(parseNgrokTunnels(json), 'ffuyfm8-jorgo03-8081.exp.direct')
})

test('falls back to a non-https tunnel rather than reporting none', () => {
  const json = JSON.stringify({ tunnels: [{ public_url: 'http://abc-user-8081.exp.direct' }] })
  assert.equal(parseNgrokTunnels(json), 'abc-user-8081.exp.direct')
})

test('an agent with no tunnels registered yields null', () => {
  assert.equal(parseNgrokTunnels(JSON.stringify({ tunnels: [] })), null)
})

test('malformed or non-JSON bodies yield null rather than throwing', () => {
  // The poll loop must survive a half-written response or an HTML error page.
  assert.equal(parseNgrokTunnels('<html>not json</html>'), null)
  assert.equal(parseNgrokTunnels(''), null)
  assert.equal(parseNgrokTunnels(JSON.stringify({ tunnels: 'nope' })), null)
  assert.equal(parseNgrokTunnels(JSON.stringify({ tunnels: [{ public_url: 'not a url' }] })), null)
})
