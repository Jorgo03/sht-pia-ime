// Unit tests for listing-photo thumbnails. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thumbnailUrl } from '../src/lib/imageUrl.js'

const BASE = 'https://xzzzhlwmzotibrxdqmcm.supabase.co/storage/v1'
const photo = `${BASE}/object/public/property-images/agent-1/photo%201.jpg`

test('switched off, every URL comes back unchanged', () => {
  assert.equal(thumbnailUrl(photo, 480, false), photo)
})

test('a public storage photo is served resized through the render endpoint', () => {
  assert.equal(
    thumbnailUrl(photo, 480, true),
    `${BASE}/render/image/public/property-images/agent-1/photo%201.jpg?width=480&quality=70&resize=cover`,
  )
})

test('the width is rounded up to a 160px step, so nearby sizes share one cached file', () => {
  assert.match(thumbnailUrl(photo, 301, true), /width=320&/)
  assert.match(thumbnailUrl(photo, 320, true), /width=320&/)
  assert.match(thumbnailUrl(photo, 1, true), /width=160&/)
})

test('a URL that already has a query string keeps it', () => {
  assert.equal(
    thumbnailUrl(`${photo}?v=2`, 480, true),
    `${BASE}/render/image/public/property-images/agent-1/photo%201.jpg?v=2&width=480&quality=70&resize=cover`,
  )
})

test('anything that is not a public Supabase object is left alone', () => {
  for (const url of [
    'https://images.unsplash.com/photo-1?w=1200',
    `${BASE}/object/sign/property-images/a.jpg?token=x`,
    `${BASE}/render/image/public/property-images/a.jpg?width=480`,
    'file:///local/photo.jpg',
  ]) {
    assert.equal(thumbnailUrl(url, 480, true), url)
  }
})

test('empty, missing or odd input is returned as it came', () => {
  assert.equal(thumbnailUrl(undefined, 480, true), undefined)
  assert.equal(thumbnailUrl(null, 480, true), null)
  assert.equal(thumbnailUrl('', 480, true), '')
  assert.equal(thumbnailUrl(photo, 0, true), photo)
  assert.equal(thumbnailUrl(photo, Number.NaN, true), photo)
})
