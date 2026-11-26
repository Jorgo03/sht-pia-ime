import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { buildXlsx, columnName, crc32, sheetName } from '../lib/xlsx.js'
import { journeyEvents, reportFileName, reportSheets, tableRows } from '../lib/data-report.js'

// "Download my data" as an Excel report (lib/data-report.js, lib/xlsx.js).

const UID = '0b5c3f0e-1111-4222-8333-444455556666'
const OTHER = '9b5c3f0e-1111-4222-8333-444455556666'

/** The files inside a stored zip, read back by walking the central directory. */
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  assert.equal(view.getUint32(end, true), 0x06054b50, 'end of central directory')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = {}
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50)
    const method = view.getUint16(at + 10, true)
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 20, true)
    const nameLen = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    const start = local + 30 + view.getUint16(local + 26, true)
    const raw = bytes.subarray(start, start + size)
    const data = method === 8 ? inflateRawSync(raw) : raw
    assert.equal(crc32(data), crc, `crc of ${name}`)
    files[name] = new TextDecoder().decode(data)
    at += 46 + nameLen
  }
  return files
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})

test('column names run A…Z, AA…', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnName), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
})

test('sheet names are cleaned, shortened and unique', () => {
  const taken = new Set()
  assert.equal(sheetName('Saved [homes]/2026', taken), 'Saved  homes  2026')
  assert.equal(sheetName('x'.repeat(40), taken).length, 31)
  assert.equal(sheetName('Profile', taken), 'Profile')
  assert.equal(sheetName('profile', taken), 'profile 2')
})

test('the workbook is a valid zip with every part and escaped text', () => {
  const files = unzip(buildXlsx([
    { name: 'One', rows: [['a', 'b'], ['<x> & "y"', 3], [true, { k: 1 }]] },
    { name: 'Two', rows: [['only']], header: false },
  ]))
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(files[part], part)
  const s1 = files['xl/worksheets/sheet1.xml']
  assert.match(s1, /&lt;x&gt; &amp; &quot;y&quot;/)
  assert.match(s1, /<c r="B2"><v>3<\/v><\/c>/)
  assert.match(s1, /<c r="A3" t="b"><v>1<\/v><\/c>/)
  assert.match(s1, /\{&quot;k&quot;:1\}/)
  assert.match(s1, /state="frozen"/)
  assert.match(s1, /<autoFilter ref="A1:B3"\/>/)
  assert.doesNotMatch(files['xl/worksheets/sheet2.xml'], /autoFilter|frozen/)
  assert.match(files['xl/workbook.xml'], /<sheet name="One"/)
  assert.match(files['xl/workbook.xml'], /_xlnm\._FilterDatabase/)
})

test('characters XML cannot hold are dropped, not written', () => {
  const files = unzip(buildXlsx([{ name: 'S', rows: [['h'], ['a\u0000b\u0007c']] }]))
  assert.match(files['xl/worksheets/sheet1.xml'], />abc</)
})

test('a table sheet has every column once, with dates readable', () => {
  const rows = tableRows([{ id: 1, created_at: '2026-11-20T10:05:00Z' }, { id: 2, note: 'x' }])
  assert.deepEqual(rows[0], ['id', 'created_at', 'note'])
  assert.match(rows[1][1], /^2026-11-2\d \d\d:05$/)
  assert.deepEqual(rows[2], [2, '', 'x'])
})

test('the journey is in date order and tells sent from received', () => {
  const events = journeyEvents(UID, {
    profiles: [{ id: UID, full_name: 'Ana', created_at: '2026-01-01T00:00:00Z' }],
    favorites: [{ property_id: 'p9', created_at: '2026-03-01T00:00:00Z' }],
    viewings: [{ property_id: 'p9', client_id: UID, agent_id: OTHER, status: 'requested', scheduled_at: '2026-03-05T09:00:00Z', created_at: '2026-03-02T00:00:00Z' }],
    messages: [
      { sender_id: OTHER, body: 'Hello', created_at: '2026-03-04T00:00:00Z' },
      { sender_id: UID, body: 'Hi', created_at: '2026-03-03T00:00:00Z' },
    ],
  }, { p9: 'Flat in Tirana' })
  assert.deepEqual(events.map((e) => e.kind), ['joined', 'saved', 'viewingRequested', 'messageSent', 'messageReceived'])
  assert.equal(events[1].detail, 'Flat in Tirana')
  assert.equal(events[2].status, 'requested')
})

test('the report has a summary, the journey, and a sheet per kind of data', () => {
  const t = (k) => k
  const sheets = reportSheets({ userId: UID, email: 'a@example.com', sections: { profiles: [{ id: UID, role: 'buyer', created_at: '2026-01-01T00:00:00Z' }], favorites: [], messages: [] }, titles: {}, t })
  assert.deepEqual(sheets.map((s) => s.name), ['dataExport.sheetSummary', 'dataExport.sheetJourney', 'dataExport.sections.profiles', 'dataExport.sections.favorites', 'dataExport.sections.messages'])
  assert.ok(sheets[0].rows.some((r) => r[0] === 'dataExport.email' && r[1] === 'a@example.com'))
  assert.deepEqual(sheets[3].rows, [['dataExport.none']])
  assert.equal(reportFileName(new Date('2026-11-26T10:00:00Z')), 'shtepia-ime-2026-11-26.xlsx')
})
