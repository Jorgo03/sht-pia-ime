import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fetchPublisher, publisherView } from '../src/features/properties/lib/publisher.js'

// "Published by" on a listing: agent = name, phone, office; client = name and
// phone, never an office. The database side is supabase/tests/rls_listing_publisher.sql.

const agentRow = { kind: 'agent', full_name: 'Arta Hoxha', phone: '+355691112222', agency_name: 'Future Home Orange' }
const clientRow = { kind: 'client', full_name: 'Besnik Leka', phone: '+355693334444', agency_name: null }

test('an agent shows name, phone and office', () => {
  assert.deepEqual(publisherView(agentRow, {}), {
    kind: 'agent', name: 'Arta Hoxha', phone: '+355691112222', office: 'Future Home Orange',
  })
})

test('a client shows name and phone, and never an office', () => {
  assert.deepEqual(publisherView(clientRow, {}), { kind: 'client', name: 'Besnik Leka', phone: '+355693334444', office: null })
  assert.equal(publisherView({ ...clientRow, agency_name: 'Should not show' }, {}).office, null)
  assert.equal(publisherView(clientRow, { agent: { agency_name: 'Should not show' } }).office, null)
})

test('missing details are null, never undefined or blank', () => {
  const none = publisherView({ kind: 'client', full_name: '  ', phone: '', agency_name: null }, {})
  assert.deepEqual(none, { kind: 'client', name: null, phone: null, office: null })
  assert.deepEqual(publisherView(null, null), { kind: 'client', name: null, phone: null, office: null })
  assert.deepEqual(publisherView({ kind: 'agent', full_name: 'Arta', phone: null, agency_name: '' }, {}), {
    kind: 'agent', name: 'Arta', phone: null, office: null,
  })
})

test('with no answer from the server it uses what the listing already carries', () => {
  const listing = { agent: { full_name: 'Arta', phone: '+1', agency_name: 'Office' }, contact_phone: '+2', owner_type: 'agent' }
  assert.deepEqual(publisherView(null, listing), { kind: 'agent', name: 'Arta', phone: '+2', office: 'Office' })
  assert.deepEqual(publisherView(null, { agent: null, contact_phone: ' +3 ', owner_type: 'client' }), {
    kind: 'client', name: null, phone: '+3', office: null,
  })
})

test('it asks for this listing and passes no user id', async () => {
  let args
  const client = { rpc: async (name, a) => { args = [name, a]; return { data: [agentRow], error: null } } }
  assert.deepEqual(await fetchPublisher(client, 'p1'), agentRow)
  assert.deepEqual(args, ['listing_publisher', { p_property: 'p1' }])
  assert.equal(await fetchPublisher({ rpc: async () => ({ data: [], error: null }) }, 'p1'), null)
  await assert.rejects(fetchPublisher({ rpc: async () => ({ data: null, error: new Error('x') }) }, 'p1'))
})

test('the database function checks visibility and hides a client office', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261108203236_listing_publisher.sql', import.meta.url), 'utf8')
  assert.match(sql, /p\.status = 'active'/)
  assert.match(sql, /case when pr\.role = 'agent' then nullif\(trim\(pr\.agency_name\)/)
  assert.match(sql, /on pr\.id = p\.owner_id/, 'the original publisher, not the viewer')
  assert.doesNotMatch(sql, /email|avatar|bio/i)
})
