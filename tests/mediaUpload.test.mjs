import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { chooseUploadSource, isDuplicateKey, readBytes, uploadAllOrNothing } from '../src/features/listings/lib/mediaUpload.js'
import { bodySize, saveAvatar } from '../src/features/auth/lib/avatar.js'

// Photo preparation and upload for listings and profile photos
// (src/features/listings/lib/mediaUpload.js). Mocked I/O except the last
// test, which runs the real supabase-js storage client against a recording
// fetch.

const MB = 1024 * 1024
const original = (o = {}) => ({ uri: 'file:///photo.jpg', mimeType: 'image/jpeg', size: 2 * MB, ...o })

test('a processed photo is uploaded as JPEG', () => {
  assert.deepEqual(chooseUploadSource({ processed: 'file:///out.jpg', original: original(), maxBytes: 10 * MB }), {
    uri: 'file:///out.jpg', contentType: 'image/jpeg', ext: 'jpg', fallback: false,
  })
})

test('when processing fails, only a valid original may be uploaded instead', () => {
  const failure = new Error('Image context has been lost')
  assert.deepEqual(chooseUploadSource({ processed: null, failure, original: original({ mimeType: 'image/png' }), maxBytes: 10 * MB }), {
    uri: 'file:///photo.jpg', contentType: 'image/png', ext: 'png', fallback: true,
  })
  for (const bad of [
    original({ mimeType: 'image/heic' }), // the bucket would refuse it
    original({ size: 11 * MB }), // over the listing limit
    original({ size: null }), // unknown size: cannot prove it fits
    original({ size: 0 }),
    null,
  ]) {
    assert.throws(() => chooseUploadSource({ processed: null, failure, original: bad, maxBytes: 10 * MB }), (e) => e.stage === 'prepare')
  }
})

test('an empty or unreadable file is a failure, never an upload', async () => {
  const fakeFetch = (bytes) => async () => ({ arrayBuffer: async () => new ArrayBuffer(bytes) })
  assert.equal((await readBytes(fakeFetch(5), 'file:///a')).byteLength, 5)
  await assert.rejects(readBytes(fakeFetch(0), 'file:///a'), (e) => e.stage === 'read')
  await assert.rejects(readBytes(async () => { throw new Error('gone') }, 'file:///a'), (e) => e.stage === 'read')
})

test('all or nothing, in order: a failing second photo removes the first and says which stage failed', async () => {
  const removed = []
  const uploaded = []
  const run = (failAt, stage) =>
    uploadAllOrNothing({
      items: ['a', 'b', 'c'],
      prepare: async (item) => {
        if (stage === 'prepare' && item === failAt) throw new Error('native')
        return { uri: item, contentType: 'image/jpeg', ext: 'jpg' }
      },
      read: async () => new ArrayBuffer(3),
      upload: async (source) => {
        if (stage === 'upload' && source.uri === failAt) throw new Error('400')
        uploaded.push(source.uri)
        return `path-${source.uri}`
      },
      remove: async (paths) => removed.push(...paths),
    })
  assert.deepEqual(await run(null, null), ['path-a', 'path-b', 'path-c'])
  removed.length = 0
  await assert.rejects(run('b', 'prepare'), (e) => e.stage === 'prepare')
  assert.deepEqual(removed, ['path-a'])
  removed.length = 0
  await assert.rejects(run('c', 'upload'), (e) => e.stage === 'upload' && e.uploadFailed === true)
  assert.deepEqual(removed, ['path-a', 'path-b'])
})

test('a retried insert that already landed is recognised', () => {
  assert.equal(isDuplicateKey({ code: '23505' }), true)
  assert.equal(isDuplicateKey({ code: '42501' }), false)
  assert.equal(isDuplicateKey(null), false)
})

test('avatar body: Blob (website) or ArrayBuffer (phone); empty or oversized is refused', async () => {
  assert.equal(bodySize(new ArrayBuffer(10)), 10)
  assert.equal(bodySize(new Blob(['abc'])), 3)
  assert.equal(bodySize(null), null)
  const client = { storage: { from: () => ({ upload: async () => assert.fail('must not upload') }) } }
  assert.equal((await saveAvatar(client, 'u', new ArrayBuffer(0), null)).status, 'failed')
  assert.equal((await saveAvatar(client, 'u', new ArrayBuffer(3 * MB), null)).status, 'tooLarge')
})

test('supabase-js sends an ArrayBuffer as the raw body with the real Content-Type', async () => {
  // Live 2026-10-21: the phone's Blob went out as multipart and the bucket
  // answered "mime type text/plain is not supported". With bytes, the type
  // the bucket checks is the request's own Content-Type.
  const sent = []
  const fakeFetch = async (url, init) => {
    sent.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body })
    return new Response(JSON.stringify({ Key: 'avatars/u/a.jpg', Id: '1' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const client = createClient('https://e2e.supabase.co', 'anon', { global: { fetch: fakeFetch }, auth: { persistSession: false } })
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
  const { error } = await client.storage.from('avatars').upload('u/a.jpg', bytes, { contentType: 'image/jpeg' })
  assert.equal(error, null)
  const req = sent.find((r) => r.url.includes('/storage/v1/object/avatars/u/a.jpg'))
  assert.ok(req, 'upload request sent')
  assert.equal(req.headers.get('content-type'), 'image/jpeg')
  assert.ok(!(req.body instanceof FormData), 'not multipart')
  assert.equal(new Uint8Array(req.body instanceof ArrayBuffer ? req.body : req.body.buffer ?? req.body)[0], 0xff)
})
