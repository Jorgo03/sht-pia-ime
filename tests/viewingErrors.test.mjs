import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { viewingRequestErrorKey } from '../src/features/viewings/lib/viewingErrors.js'

// AUDIT-003: the database now refuses a viewing that overlaps another open one
// (migration 20261113194212, error 23P01). Both apps must say the time is
// taken instead of a generic "request failed".

test('an overlapping time says the slot is taken', () => {
  assert.equal(viewingRequestErrorKey({ code: '23P01', message: 'viewing_slot_taken' }), 'viewings.slotTaken')
})

test('a past time says pick a future date', () => {
  assert.equal(viewingRequestErrorKey({ code: '23514', message: 'a viewing cannot be in the past' }), 'viewings.pastDate')
})

test('anything else stays the generic failure', () => {
  for (const e of [{ code: '42501' }, { message: 'network' }, null, undefined]) {
    assert.equal(viewingRequestErrorKey(e), 'viewings.requestFailed')
  }
})

test('the new message exists in all 8 locales', () => {
  for (const l of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const j = JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'))
    assert.equal(typeof j.viewings.slotTaken, 'string', l)
    assert.ok(j.viewings.slotTaken.length > 5, l)
  }
})

test('both apps route viewing request errors through the helper', () => {
  for (const f of ['app/property/[id].tsx', 'src/features/viewings/components/ViewingRequestSheet.jsx']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /viewingRequestErrorKey\(/, f)
  }
})
