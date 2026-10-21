import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, cleanRoute, createReporter, fingerprint, redact, MAX_REPORTS_PER_SESSION } from '../src/lib/errorReport.js'

// Error reporting (docs/LAUNCH_TASKS.md F11). These pin the privacy rules:
// nothing identifying leaves the device, and reporting can never become a
// flood or a crash of its own.

test('redacts emails, phone numbers, tokens, keys and ids, ids first', () => {
  const out = redact(
    'ana@example.com +355 69 123 4567 Bearer abc.def eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig sk-ant-api03-aaaaaaaaaaaaaaaaaaaa 9c47f15e-3359-4716-910e-315d2a5e2518',
  )
  assert.equal(out, '<redacted> <redacted> <redacted> <redacted> <redacted> <redacted>')
})

test('keeps what is useful for debugging', () => {
  assert.equal(redact("Cannot read properties of undefined (reading 'price')"), "Cannot read properties of undefined (reading 'price')")
  assert.equal(redact('at PropertyCard (index-abc.js:1:2345)'), 'at PropertyCard (index-abc.js:1:2345)')
})

test('routes lose their query string and fragment', () => {
  assert.equal(cleanRoute('/search?city=Tiranë&q=ana@x.com#top'), '/search')
  assert.equal(cleanRoute(''), null)
})

test('the same error gets the same fingerprint; a different one does not', () => {
  const stack = 'Error: boom\n    at render (a.js:1:2)\n    at x (b.js:3:4)'
  assert.equal(fingerprint('render', 'boom', stack), fingerprint('render', 'boom', stack))
  assert.notEqual(fingerprint('render', 'boom', stack), fingerprint('uncaught', 'boom', stack))
  assert.match(fingerprint('render', 'boom', stack), /^[a-z0-9]{1,64}$/)
})

test('a report carries no user and fits the table limits', () => {
  const err = new Error('x'.repeat(900))
  const row = buildReport({ platform: 'web', appVersion: '1.0.0', route: '/p/1?x=1', kind: 'render', error: err })
  assert.deepEqual(Object.keys(row).sort(), ['app_version', 'fingerprint', 'kind', 'message', 'platform', 'route', 'stack'])
  assert.equal(row.message.length, 500)
  assert.ok(row.stack.length <= 4000)
  assert.equal(row.route, '/p/1')
  assert.equal(buildReport({ platform: 'web', kind: 'uncaught', error: '   ' }), null)
  assert.equal(buildReport({ platform: 'ios', kind: 'unhandled_rejection', error: { code: 42 } }).message, '{"code":42}')
})

function fakeClient(result = { error: null }) {
  const rows = []
  return { rows, from: (t) => ({ insert: async (row) => { rows.push([t, row]); return result } }) }
}

test('disabled (development, tests) sends nothing', async () => {
  const c = fakeClient()
  const report = createReporter({ client: c, platform: 'web', enabled: false })
  assert.equal(await report('render', new Error('boom'), '/'), false)
  assert.deepEqual(c.rows, [])
})

test('one report per distinct error, and at most 10 per session', async () => {
  const c = fakeClient()
  const report = createReporter({ client: c, platform: 'android', appVersion: '1.0.0', enabled: true })
  // The same throw site twice, as a real repeated crash would be.
  const crash = () => new Error('same')
  assert.equal(await report('uncaught', crash(), '/'), true)
  assert.equal(await report('uncaught', crash(), '/'), false)
  for (let i = 0; i < 20; i++) await report('uncaught', new Error(`e${i}`), '/')
  assert.equal(c.rows.length, MAX_REPORTS_PER_SESSION)
  assert.equal(c.rows[0][0], 'client_errors')
})

test('a failing insert or a throwing client never throws', async () => {
  const report = createReporter({ client: { from() { throw new Error('offline') } }, platform: 'web', enabled: true })
  assert.equal(await report('render', new Error('boom'), '/'), false)
  const report2 = createReporter({ client: fakeClient({ error: { code: '42501' } }), platform: 'web', enabled: true })
  assert.equal(await report2('render', new Error('boom'), '/'), false)
})
