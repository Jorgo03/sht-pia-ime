import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { propertyOrNotFound } from '../src/features/properties/lib/propertyResult.js'

// AUDIT-006: a listing that failed to load (offline, timeout, 5xx) was shown as
// "no longer available" with no way to retry. Only PostgREST's "no such row"
// means gone; anything else is an error the screen can retry.

test('a found listing is returned', () => {
  assert.deepEqual(propertyOrNotFound({ data: { id: 'x' }, error: null }), { id: 'x' })
})

test('no such row means not found (null)', () => {
  assert.equal(propertyOrNotFound({ data: null, error: { code: 'PGRST116', message: '0 rows' } }), null)
  assert.equal(propertyOrNotFound({ data: null, error: null }), null)
})

test('any other error is thrown, so the screen can offer a retry', () => {
  const err = { code: '', message: 'TypeError: Network request failed' }
  assert.throws(() => propertyOrNotFound({ data: null, error: err }), (e) => e === err)
  assert.throws(() => propertyOrNotFound({ data: null, error: { code: '57014', message: 'timeout' } }))
})

test('the phone app uses it and shows a retry when loading fails', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const data = read('data/properties.ts')
  const fn = data.slice(data.indexOf('export async function getPropertyById'))
  assert.match(fn.slice(0, 900), /propertyOrNotFound(<\w+>)?\(/)
  const screen = read('app/property/[id].tsx')
  assert.match(screen, /isError: loadFailed/)
  assert.match(screen, /<LoadError onRetry=\{\(\) => refetch\(\)\}/)
})
