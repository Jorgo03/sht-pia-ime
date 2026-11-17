import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGE_SIZE, isModerator, loadReports, resolveReport, setListingHidden } from '../src/features/moderation/lib/moderation.js'

// The moderation queue (F3). The database enforces who may read and act
// (supabase/tests/rls_moderation*.sql); these pin what the website sends and
// how it reads the answers.

// A fake client: every query records its calls and resolves with answer(call).
function fakeClient(answer) {
  const calls = []
  const query = (table) => {
    const call = { table, select: null, filters: [], order: null, range: null }
    calls.push(call)
    const chain = {
      select(cols) { call.select = cols; return chain },
      eq(col, val) { call.filters.push(['eq', col, val]); return chain },
      in(col, val) { call.filters.push(['in', col, val]); return chain },
      order(col, opts) { call.order = [col, opts.ascending]; return chain },
      range(from, to) { call.range = [from, to]; return chain },
      then(resolve, reject) { return Promise.resolve(answer(call)).then(resolve, reject) },
    }
    return chain
  }
  const rpcs = []
  return {
    calls,
    rpcs,
    from: query,
    rpc(name, args) { rpcs.push([name, args]); return Promise.resolve(answer({ rpc: name, args })) },
  }
}

test('only a database "true" makes someone a moderator', async () => {
  assert.equal(await isModerator(fakeClient(() => ({ data: true, error: null }))), true)
  assert.equal(await isModerator(fakeClient(() => ({ data: false, error: null }))), false)
  assert.equal(await isModerator(fakeClient(() => ({ data: null, error: { code: '42501' } }))), false)
  assert.equal(await isModerator({ rpc: () => { throw new Error('offline') } }), false)
})

test('the open queue asks for open reports, newest first, one page plus one', async () => {
  const c = fakeClient((call) => ({ data: call.table === 'content_reports' ? [] : [], error: null }))
  const result = await loadReports(c)
  assert.deepEqual(result, { rows: [], more: false })
  assert.deepEqual(c.calls[0].filters, [['eq', 'status', 'open']])
  assert.deepEqual(c.calls[0].order, ['created_at', false])
  assert.deepEqual(c.calls[0].range, [0, PAGE_SIZE])
  // No listing or profile lookups for an empty page.
  assert.equal(c.calls.length, 1)
})

test('the closed queue holds actioned and dismissed reports', async () => {
  const c = fakeClient(() => ({ data: [], error: null }))
  await loadReports(c, { queue: 'closed', offset: 24 })
  assert.deepEqual(c.calls[0].filters, [['in', 'status', ['actioned', 'dismissed']]])
  assert.deepEqual(c.calls[0].order, ['reviewed_at', false])
  assert.deepEqual(c.calls[0].range, [24, 24 + PAGE_SIZE])
})

test('reports come back with their listing and account, missing ones as null', async () => {
  const reports = [
    { id: 'r1', property_id: 'p1', reported_user_id: null },
    { id: 'r2', property_id: null, reported_user_id: 'u1' },
    { id: 'r3', property_id: 'gone', reported_user_id: null },
  ]
  const c = fakeClient((call) => {
    if (call.table === 'content_reports') return { data: reports, error: null }
    if (call.table === 'properties') return { data: [{ id: 'p1', title: 'Flat' }], error: null }
    return { data: [{ id: 'u1', full_name: 'Ana' }], error: null }
  })
  const { rows, more } = await loadReports(c)
  assert.equal(more, false)
  assert.equal(rows[0].listing.title, 'Flat')
  assert.equal(rows[0].person, null)
  assert.equal(rows[1].person.full_name, 'Ana')
  assert.equal(rows[2].listing, null)
  assert.deepEqual(c.calls[1].filters, [['in', 'id', ['p1', 'gone']]])
  assert.deepEqual(c.calls[2].filters, [['in', 'id', ['u1']]])
})

test('a full extra row means there is another page, and is not shown', async () => {
  const many = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ id: `r${i}`, property_id: null, reported_user_id: 'u1' }))
  const c = fakeClient((call) => ({ data: call.table === 'content_reports' ? many : [], error: null }))
  const { rows, more } = await loadReports(c)
  assert.equal(rows.length, PAGE_SIZE)
  assert.equal(more, true)
})

test('any failed read is an error, not an empty queue', async () => {
  assert.equal(await loadReports(fakeClient(() => ({ data: null, error: { code: '42501' } }))), null)
  const lookupFails = fakeClient((call) => (call.table === 'content_reports'
    ? { data: [{ id: 'r1', property_id: 'p1' }], error: null }
    : { data: null, error: { code: '500' } }))
  assert.equal(await loadReports(lookupFails), null)
})

test('hiding and restoring call moderate_listing with a strict boolean', async () => {
  const c = fakeClient(() => ({ error: null }))
  assert.equal(await setListingHidden(c, 'p1', true), true)
  assert.equal(await setListingHidden(c, 'p1', 'yes'), true)
  assert.deepEqual(c.rpcs, [['moderate_listing', { p_property: 'p1', p_hide: true }], ['moderate_listing', { p_property: 'p1', p_hide: false }]])
  assert.equal(await setListingHidden(fakeClient(() => ({ error: { code: '42501' } })), 'p1', true), false)
})

test('resolving sends only actioned or dismissed, with a trimmed, capped note', async () => {
  const c = fakeClient(() => ({ error: null }))
  assert.equal(await resolveReport(c, 'r1', 'open'), false)
  assert.equal(c.rpcs.length, 0)
  assert.equal(await resolveReport(c, 'r1', 'dismissed', '   '), true)
  assert.deepEqual(c.rpcs[0], ['resolve_report', { p_report: 'r1', p_status: 'dismissed', p_note: null }])
  await resolveReport(c, 'r1', 'actioned', ` ${'x'.repeat(1200)} `)
  assert.equal(c.rpcs[1][1].p_note.length, 1000)
  assert.equal(await resolveReport(fakeClient(() => ({ error: { code: '42501' } })), 'r1', 'actioned'), false)
})
