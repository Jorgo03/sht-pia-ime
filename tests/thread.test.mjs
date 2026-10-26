import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNotFound, loadThreadMessages, MESSAGE_HISTORY_LIMIT } from '../src/features/messaging/lib/thread.js'

// A stand-in for the supabase query builder that records the chain.
function client(result) {
  const calls = []
  const builder = {
    select: (...a) => (calls.push(['select', ...a]), builder),
    eq: (...a) => (calls.push(['eq', ...a]), builder),
    order: (...a) => (calls.push(['order', ...a]), builder),
    limit: (...a) => (calls.push(['limit', ...a]), typeof result === 'function' ? result() : Promise.resolve(result)),
  }
  return { calls, from: (table) => (calls.push(['from', table]), builder) }
}

test('opens with the newest messages, bounded, shown oldest first', async () => {
  const c = client({ data: [{ id: 3 }, { id: 2 }, { id: 1 }], error: null })
  const { messages, error } = await loadThreadMessages(c, 'conv-1')
  assert.equal(error, null)
  assert.deepEqual(messages.map((m) => m.id), [1, 2, 3])
  assert.deepEqual(c.calls.find((x) => x[0] === 'order'), ['order', 'created_at', { ascending: false }])
  assert.deepEqual(c.calls.find((x) => x[0] === 'limit'), ['limit', MESSAGE_HISTORY_LIMIT])
})

test('a failed load is an error, never an empty conversation', async () => {
  const failed = await loadThreadMessages(client({ data: null, error: { message: 'timeout' } }), 'c')
  assert.equal(failed.messages, null)
  assert.ok(failed.error)
  const thrown = await loadThreadMessages(client(() => Promise.reject(new TypeError('Failed to fetch'))), 'c')
  assert.equal(thrown.messages, null)
  assert.ok(thrown.error)
  const empty = await loadThreadMessages(client({ data: [], error: null }), 'c')
  assert.deepEqual(empty, { messages: [], error: null })
})

test('only "no such row" counts as not found', () => {
  assert.equal(isNotFound({ code: 'PGRST116' }), true)
  assert.equal(isNotFound({ message: 'Failed to fetch' }), false)
  assert.equal(isNotFound(null), false)
})
