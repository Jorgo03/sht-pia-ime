// Photos and documents in chats (src/features/messaging/lib/attachments.js):
// what may be sent, where it is stored, how it is named, and that the list
// matches the database's (migration 20261111234947).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  ATTACHMENT_TYPES,
  DOCUMENT_PICKER_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  attachmentRecord,
  attachmentType,
  checkAttachment,
  displayName,
  formatBytes,
  readAttachment,
} from '../src/features/messaging/lib/attachments.js'

const CONV = 'a1b2c3d4-0000-4000-8000-000000000001'

test('the type comes from the file, or from its name when the picker does not say', () => {
  assert.equal(attachmentType('image/jpeg', 'x.png'), 'image/jpeg')
  assert.equal(attachmentType('application/octet-stream', 'Kontrata.DOCX'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.equal(attachmentType(null, 'tabela.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  assert.equal(attachmentType('text/plain; charset=utf-8', 'a'), 'text/plain')
  assert.equal(attachmentType('application/pdf', 'scan'), 'application/pdf')
  for (const [mime, name] of [['text/html', 'a.html'], ['application/x-msdownload', 'a.exe'], ['image/heic', 'a.heic'], ['video/mp4', 'a.mp4'], [null, 'noext'], [null, 'a.pdf.exe']]) {
    assert.equal(attachmentType(mime, name), null, `${mime} ${name}`)
  }
})

test('a file over 10 MB, empty, or of another type cannot be sent', () => {
  assert.equal(checkAttachment({ mime: 'application/pdf', name: 'a.pdf', size: 2_000_000 }), null)
  assert.equal(checkAttachment({ mime: 'application/pdf', name: 'a.pdf', size: undefined }), null) // the bucket still checks
  assert.equal(checkAttachment({ mime: 'application/pdf', name: 'a.pdf', size: MAX_ATTACHMENT_BYTES }), null)
  assert.equal(checkAttachment({ mime: 'application/pdf', name: 'a.pdf', size: MAX_ATTACHMENT_BYTES + 1 }), 'size')
  assert.equal(checkAttachment({ mime: 'image/jpeg', name: 'a.jpg', size: 0 }), 'size')
  assert.equal(checkAttachment({ mime: 'text/html', name: 'a.html', size: 10 }), 'type')
})

test('stored in the conversation folder, named from the type, never from the file name', () => {
  assert.equal(attachmentPath(CONV, 'application/pdf', { now: 1731400000000, random: 'Ab-9z' }), `${CONV}/1731400000000-ab9z.pdf`)
  assert.equal(attachmentPath(CONV.toUpperCase(), 'image/jpeg', { now: 5, random: '' }), `${CONV}/5-f.jpg`)
  // The database's check: <uuid>/<digits>-<a-z0-9>.<allowed ext>
  const dbPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9]+-[a-z0-9]+\.(jpg|png|webp|pdf|doc|docx|xls|xlsx|txt)$/
  for (const mime of Object.keys(ATTACHMENT_TYPES)) assert.match(attachmentPath(CONV, mime), dbPattern, mime)
  assert.throws(() => attachmentPath('not-a-conversation', 'image/jpeg'))
  assert.throws(() => attachmentPath(CONV, 'text/html'))
})

test('display names: no folders or hidden direction marks, long names keep their extension', () => {
  assert.equal(displayName('C:\\Users\\ana\\Kontrata.pdf', 'application/pdf'), 'Kontrata.pdf')
  assert.equal(displayName('/var/mobile/x/foto 1.jpg', 'image/jpeg'), 'foto 1.jpg')
  assert.equal(displayName('fatura\u202Efdp.exe', 'application/pdf'), 'faturafdp.exe')
  assert.equal(displayName('', 'image/jpeg', 'foto'), 'foto.jpg')
  assert.equal(displayName(null, 'application/pdf'), 'file.pdf')
  const long = displayName(`${'a'.repeat(200)}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.equal(long.length, 120)
  assert.ok(long.endsWith('….docx'))
})

test('the record and a received row', () => {
  const rec = attachmentRecord({ path: `${CONV}/1-a.jpg`, name: 'a.jpg', mime: 'image/jpeg', size: 10 })
  assert.deepEqual(rec, { path: `${CONV}/1-a.jpg`, name: 'a.jpg', mime: 'image/jpeg', size: 10, kind: 'image' })
  assert.deepEqual(readAttachment(rec), rec)
  assert.equal(readAttachment({ ...rec, mime: 'text/html' }), null)
  assert.equal(readAttachment(null), null)
  assert.equal(readAttachment('x'), null)
  assert.equal(readAttachment({ path: 'p', mime: 'application/pdf' }).name, 'file.pdf')
})

test('sizes read naturally', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(120_000), '117 KB')
  assert.equal(formatBytes(2_500_000), '2.4 MB')
  assert.equal(formatBytes(0), '')
  assert.equal(formatBytes(null), '')
})

test('the app, the picker and the database allow exactly the same types and size', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261111234947_message_attachments.sql', import.meta.url), 'utf8')
  const bucket = /allowed_mime_types\)[\s\S]*?array\[([\s\S]*?)\]/.exec(sql)
  assert.ok(bucket, 'bucket types found')
  const dbTypes = [...bucket[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(dbTypes, Object.keys(ATTACHMENT_TYPES).sort())
  assert.deepEqual([...DOCUMENT_PICKER_TYPES].sort(), dbTypes)
  assert.match(sql, new RegExp(`\\b${MAX_ATTACHMENT_BYTES}\\b`))
})
