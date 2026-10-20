import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySavedFilters, countMatches, markSeen, newMatchCount } from '../src/features/saved-searches/lib/matches.js'

// Saved-search "new matches" (docs/LAUNCH_TASKS.md L06). The bell used to
// promise alerts nothing sent; the app now shows how many more listings match
// than last time. These pin the filter rules (same as the Search page) and the
// count arithmetic.

function recorder(result = { count: 0, error: null }) {
  const calls = []
  const q = new Proxy({}, {
    get(_, op) {
      if (op === 'then') return (resolve) => resolve(result)
      return (...args) => { calls.push([op, ...args]); return q }
    },
  })
  return { calls, q, client: { from: (t) => { calls.push(['from', t]); return q } } }
}

test('filters follow the Search page rules', () => {
  const { calls, q } = recorder()
  applySavedFilters(q, { city: 'Tiranë', listing_type: 'rent', type: 'apartment', minPrice: '200', maxPrice: 900, beds: 2 })
  assert.deepEqual(calls, [
    ['ilike', 'city', '%Tiranë%'],
    ['eq', 'listing_type', 'rent'],
    ['eq', 'property_type', 'apartment'],
    ['gte', 'price', 200],
    ['lte', 'price', 900],
    ['gte', 'beds', 2],
  ])
})

test('empty, "all" and nonsense values add no filter', () => {
  const { calls, q } = recorder()
  applySavedFilters(q, { city: '', type: 'all', minPrice: '', maxPrice: 'abc', beds: null })
  applySavedFilters(q, null)
  assert.deepEqual(calls, [])
})

test('the count only looks at active listings', async () => {
  const r = recorder({ count: 7, error: null })
  assert.equal(await countMatches(r.client, { city: 'Durrës' }), 7)
  assert.deepEqual(r.calls.slice(0, 3), [
    ['from', 'properties'],
    ['select', 'id', { count: 'exact', head: true }],
    ['eq', 'status', 'active'],
  ])
})

test('a failed count is unknown (null), not zero', async () => {
  assert.equal(await countMatches(recorder({ count: null, error: { message: 'x' } }).client, {}), null)
  assert.equal(await countMatches({ from() { throw new Error('offline') } }, {}), null)
})

test('new matches = more than last time, never negative', () => {
  assert.equal(newMatchCount(9, 6), 3)
  assert.equal(newMatchCount(4, 6), 0)
  assert.equal(newMatchCount(5, null), 5)
  assert.equal(newMatchCount(null, 2), 0)
})

test('marking as seen stores the current count, and skips an unknown one', async () => {
  const r = recorder({ error: null })
  assert.equal(await markSeen(r.client, 's1', 9), true)
  assert.deepEqual(r.calls, [['from', 'saved_searches'], ['update', { last_match_count: 9 }], ['eq', 'id', 's1']])
  const r2 = recorder()
  assert.equal(await markSeen(r2.client, 's1', null), false)
  assert.deepEqual(r2.calls, [])
})
