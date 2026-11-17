import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// AUDIT-027: /favicon.ico (asked for by browsers and search engines whatever
// the page links) and the web manifest returned the HTML page, because no such
// files existed and the site's catch-all route answered instead.

test('public/favicon.ico is a real ICO holding the brand icon as PNG', () => {
  const ico = fs.readFileSync('public/favicon.ico')
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'ICO header')
  const count = ico.readUInt16LE(4)
  assert.ok(count >= 1)
  const offset = ico.readUInt32LE(6 + 12)
  assert.deepEqual([...ico.subarray(offset, offset + 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG inside')
})

test('the web manifest is valid and its icons exist', () => {
  const m = JSON.parse(fs.readFileSync('public/site.webmanifest', 'utf8'))
  assert.equal(m.name, 'Shtëpia.ime')
  assert.ok(m.icons.length >= 2)
  for (const i of m.icons) assert.ok(fs.existsSync(`public${i.src}`), i.src)
})

test('both website shells link the manifest', () => {
  for (const f of ['index.html', 'app/+html.tsx']) {
    assert.match(fs.readFileSync(f, 'utf8'), /<link rel="manifest" href="\/site\.webmanifest"/, f)
  }
})
