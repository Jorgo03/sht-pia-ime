// Uploads (AUDIT.md Pass 37): only the types the storage buckets accept, a
// size limit, a random name from the checked type, stored in a bucket and
// served as media, never run.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { UPLOAD_TYPES, extensionFor, uploadPath } from '../src/lib/uploadNames.js'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const ID = 'e2e00000-0000-4000-a000-0000000000a1'

// The live property-images bucket's allowed_mime_types (checked 2026-11-04).
const BUCKET_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']

test('the allowed types are the bucket\'s, and nothing that can run in a browser', () => {
  assert.deepEqual(Object.keys(UPLOAD_TYPES).sort(), [...BUCKET_TYPES].sort())
  for (const bad of ['text/html', 'image/svg+xml', 'application/javascript', 'application/x-php', 'application/octet-stream', 'image/avif']) {
    assert.equal(extensionFor(bad), null, bad)
    assert.throws(() => uploadPath(ID, bad))
  }
})

test('a stored file is renamed: random, in the owner\'s folder, extension from the type', () => {
  const p = uploadPath(ID, 'image/jpeg', { now: 1700000000000, random: 'ab12../../x' })
  assert.equal(p, `${ID}/1700000000000-ab12x.jpg`)
  assert.match(uploadPath(ID, 'video/quicktime', { prefix: 'video-' }), new RegExp(`^${ID}/video-\\d+-[a-z0-9]+\\.mov$`))
  assert.throws(() => uploadPath('../other-user', 'image/jpeg'))
})

test('the forms only offer what the bucket accepts', () => {
  const web = read('src/features/listings/pages/NewListing.jsx')
  const list = (name) => JSON.parse(web.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'))
  for (const t of [...list('ALLOWED_IMAGE_TYPES'), ...list('ALLOWED_VIDEO_TYPES')]) assert.ok(BUCKET_TYPES.includes(t), t)
  const app = read('lib/upload.ts')
  const appVideo = JSON.parse(app.match(/ALLOWED_VIDEO_TYPES = (\[[^\]]*\])/)[1].replace(/'/g, '"'))
  for (const t of appVideo) assert.ok(BUCKET_TYPES.includes(t), t)
})

test('no upload path takes its extension from the person\'s file name', () => {
  const web = read('src/features/listings/pages/NewListing.jsx')
  assert.doesNotMatch(web, /file\.name\.split\('\.'\)\.pop\(\)/)
  assert.match(web, /uploadPath\(user\.id, img\.file\.type\)/)
  assert.match(web, /uploadPath\(user\.id, video\.file\.type, \{ prefix: 'video-' \}\)/)
  const app = read('lib/upload.ts')
  const video = app.slice(app.indexOf('export async function uploadPropertyVideo'))
  assert.match(video, /extensionFor\(video\.mimeType\)/)
  assert.doesNotMatch(video.slice(0, video.indexOf('.upload(')), /fileName\.split/)
})

test('files are only ever shown as images or video, never run', () => {
  // No code turns uploaded content into HTML or script; media is displayed
  // through <img>/<video>/expo-image, and the database only accepts https
  // links for photos and video (Pass 33).
  for (const f of ['src/features/listings/pages/NewListing.jsx', 'lib/upload.ts']) {
    assert.doesNotMatch(read(f), /dangerouslySetInnerHTML|innerHTML|eval\(|new Function\(/, f)
  }
})
