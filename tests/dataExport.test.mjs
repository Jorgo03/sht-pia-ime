import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXPORT_TABLES, exportDocument, exportFileName, ownerFilter, stripColumns } from '../lib/data-export-plan.js'

// "Download my data" (privacy policy §8: access and portability).

const UID = '0b5c3f0e-1111-4222-8333-444455556666'

test('every personal table is covered, each by its owner column', () => {
  const names = EXPORT_TABLES.map((t) => t.table)
  for (const t of ['profiles', 'properties', 'favorites', 'saved_searches', 'wanted_homes', 'viewings', 'conversations']) assert.ok(names.includes(t), t)
  for (const t of EXPORT_TABLES) assert.ok(t.match.length > 0, t.table)
})

test('secrets are not exported', () => {
  assert.ok(!EXPORT_TABLES.some((t) => t.table === 'push_tokens'))
  const saved = EXPORT_TABLES.find((t) => t.table === 'saved_searches')
  assert.deepEqual(stripColumns([{ id: 1, unsubscribe_token: 's' }], saved.omit), [{ id: 1 }])
})

test('the owner filter matches any of the columns', () => {
  assert.equal(ownerFilter(['client_id', 'agent_id'], UID), `client_id.eq.${UID},agent_id.eq.${UID}`)
})

test('the document is dated JSON with the sections', () => {
  const now = new Date('2026-11-16T10:00:00Z')
  const doc = JSON.parse(exportDocument(UID, { favorites: [{ id: 1 }] }, now))
  assert.equal(doc.user_id, UID)
  assert.equal(doc.exported_at, '2026-11-16T10:00:00.000Z')
  assert.deepEqual(doc.favorites, [{ id: 1 }])
  assert.equal(exportFileName(now), 'shtepia-ime-data-2026-11-16.json')
})
