import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REPORT_REASONS, MAX_REPORT_DETAILS, blockUser, fileReport, isBlockedSendError, loadBlockedIds, unblockUser,
} from '../src/features/safety/lib/safety.js'

// Report and block (migration 20261016181934). The database enforces the
// rules; these tests pin what the apps send and how they read its answers.

// A fake Supabase client that records calls and answers with `reply`.
function fakeClient(reply = { error: null }) {
  const calls = []
  const builder = (table) => {
    const call = { table, op: null, row: null, filters: [] }
    calls.push(call)
    const chain = {
      insert(row) { call.op = 'insert'; call.row = row; return Promise.resolve(typeof reply === 'function' ? reply(call) : reply) },
      select(cols) { call.op = 'select'; call.row = cols; return Promise.resolve(typeof reply === 'function' ? reply(call) : reply) },
      delete() { call.op = 'delete'; return chain },
      eq(col, val) { call.filters.push([col, val]); return Promise.resolve(typeof reply === 'function' ? reply(call) : reply) },
    }
    return chain
  }
  return { calls, from: builder }
}

test('the reasons match the database check constraint', () => {
  assert.deepEqual([...REPORT_REASONS], ['spam', 'scam', 'wrong_info', 'unavailable', 'offensive', 'other'])
  assert.equal(MAX_REPORT_DETAILS, 1000)
})

test('reporting a listing sends only the columns a client may fill', async () => {
  const c = fakeClient()
  assert.equal(await fileReport(c, { propertyId: 'p1', reason: 'scam', details: '  fake photos  ' }), 'sent')
  assert.deepEqual(c.calls[0], { table: 'content_reports', op: 'insert', row: { property_id: 'p1', reason: 'scam', details: 'fake photos' }, filters: [] })
})

test('reporting a user, with empty details left out', async () => {
  const c = fakeClient()
  assert.equal(await fileReport(c, { userId: 'u2', reason: 'offensive', details: '   ' }), 'sent')
  assert.deepEqual(c.calls[0].row, { reported_user_id: 'u2', reason: 'offensive' })
})

test('details are capped at 1000 characters', async () => {
  const c = fakeClient()
  await fileReport(c, { propertyId: 'p1', reason: 'other', details: 'x'.repeat(1500) })
  assert.equal(c.calls[0].row.details.length, 1000)
})

test('a second report of the same thing reads as "already"', async () => {
  assert.equal(await fileReport(fakeClient({ error: { code: '23505' } }), { propertyId: 'p1', reason: 'spam' }), 'already')
})

test('any other error, or a network failure, reads as "failed"', async () => {
  assert.equal(await fileReport(fakeClient({ error: { code: '42501' } }), { propertyId: 'p1', reason: 'spam' }), 'failed')
  const throwing = { from() { throw new Error('offline') } }
  assert.equal(await fileReport(throwing, { propertyId: 'p1', reason: 'spam' }), 'failed')
})

test('a report needs a target and a known reason, and then sends nothing', async () => {
  const c = fakeClient()
  assert.equal(await fileReport(c, { reason: 'spam' }), 'failed')
  assert.equal(await fileReport(c, { propertyId: 'p1', reason: 'because' }), 'failed')
  assert.equal(c.calls.length, 0)
})

test('blocking sends only the blocked id; blocking twice counts as done', async () => {
  const c = fakeClient()
  assert.equal(await blockUser(c, 'u2'), true)
  assert.deepEqual(c.calls[0].row, { blocked_id: 'u2' })
  assert.equal(await blockUser(fakeClient({ error: { code: '23505' } }), 'u2'), true)
  assert.equal(await blockUser(fakeClient({ error: { code: '42501' } }), 'u2'), false)
})

test('unblocking deletes by the blocked id', async () => {
  const c = fakeClient()
  assert.equal(await unblockUser(c, 'u2'), true)
  assert.deepEqual([c.calls[0].op, c.calls[0].filters], ['delete', [['blocked_id', 'u2']]])
})

test('the blocked list loads as a Set, and as empty on error', async () => {
  const ids = await loadBlockedIds(fakeClient({ data: [{ blocked_id: 'a' }, { blocked_id: 'b' }], error: null }))
  assert.deepEqual([...ids], ['a', 'b'])
  assert.equal((await loadBlockedIds(fakeClient({ data: null, error: { code: 'x' } }))).size, 0)
})

test('a refused message (42501) is recognised as "they blocked you"', () => {
  assert.equal(isBlockedSendError({ code: '42501' }), true)
  assert.equal(isBlockedSendError({ code: '23505' }), false)
  assert.equal(isBlockedSendError(null), false)
})
