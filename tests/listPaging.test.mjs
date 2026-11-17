import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LIST_PAGE_SIZE, pageWindow } from '../src/lib/pageWindow.js'

// AUDIT-015: My listings and the Messages tab loaded every row at once (no
// limit), against the 24-per-page rule. They now ask for one page more than
// they show, 24 at a time, and "Load more" raises the window.

test('one extra row tells whether there is more', () => {
  assert.equal(LIST_PAGE_SIZE, 24)
  const rows = Array.from({ length: 25 }, (_, i) => i)
  assert.deepEqual(pageWindow(rows, 24), { items: rows.slice(0, 24), hasMore: true })
  assert.deepEqual(pageWindow(rows.slice(0, 24), 24), { items: rows.slice(0, 24), hasMore: false })
  assert.deepEqual(pageWindow(null, 24), { items: [], hasMore: false })
})

test('both screens fetch a bounded window and offer Load more', () => {
  for (const f of ['app/my-listings/index.tsx', 'app/(tabs)/messages.tsx']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /\.limit\(limit \+ 1\)/, `${f}: bounded query`)
    assert.match(src, /pageWindow\(/, `${f}: uses pageWindow`)
    assert.match(src, /t\('common\.loadMore'\)/, `${f}: Load more`)
  }
})

test('the Load more label exists in all 8 locales', () => {
  for (const l of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const j = JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'))
    assert.equal(typeof j.common.loadMore, 'string', l)
  }
})
