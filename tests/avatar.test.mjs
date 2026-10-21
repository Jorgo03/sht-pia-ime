import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avatarSourceError, newAvatarPath, ownAvatarPath, removeAvatar, saveAvatar } from '../src/features/auth/lib/avatar.js'

// Profile photos (docs/LAUNCH_TASKS.md F12). The database refuses any
// avatar_url outside the caller's own avatars folder; these pin that the apps
// only ever produce such URLs, clean up after themselves, and never delete
// a file they do not own.

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const BASE = 'https://proj.supabase.co/storage/v1/object/public/avatars/'

function fakeClient({ uploadError = null, updateError = null } = {}) {
  const calls = []
  const bucket = {
    upload: async (path, _blob, opts) => { calls.push(['upload', path, opts.contentType]); return { error: uploadError } },
    getPublicUrl: (path) => ({ data: { publicUrl: BASE + path } }),
    remove: async (paths) => { calls.push(['remove', ...paths]); return { error: null } },
  }
  return {
    calls,
    storage: { from: (b) => { calls.push(['bucket', b]); return bucket } },
    from: (t) => ({ update: (patch) => ({ eq: async (c, v) => { calls.push(['update', t, patch, v]); return { error: updateError } } }) }),
  }
}
const blob = (size) => ({ size })

test('picked files: JPEG/PNG/WebP up to 15 MB; anything else is refused', () => {
  assert.equal(avatarSourceError({ type: 'image/png', size: 3_000_000 }), null)
  assert.equal(avatarSourceError({ type: 'image/gif', size: 10 }), 'type')
  assert.equal(avatarSourceError({ type: 'image/svg+xml', size: 10 }), 'type')
  assert.equal(avatarSourceError({ type: 'image/jpeg', size: 16 * 1024 * 1024 }), 'size')
})

test('new photos go in the user\'s own folder, with a name the database accepts', () => {
  const path = newAvatarPath(ME, 1700000000000)
  assert.equal(path, `${ME}/avatar-1700000000000.jpg`)
  assert.match(path.split('/')[1], /^[A-Za-z0-9._-]{1,100}$/)
})

test('only the user\'s own uploaded photo counts as theirs', () => {
  assert.equal(ownAvatarPath(`${BASE}${ME}/avatar-1.jpg`, ME), `${ME}/avatar-1.jpg`)
  assert.equal(ownAvatarPath(`${BASE}${OTHER}/avatar-1.jpg`, ME), null)
  assert.equal(ownAvatarPath('https://lh3.googleusercontent.com/a/photo', ME), null)
  assert.equal(ownAvatarPath(null, ME), null)
})

test('saving uploads, points the profile at it, then removes the old own photo', async () => {
  const c = fakeClient()
  const res = await saveAvatar(c, ME, blob(50_000), `${BASE}${ME}/avatar-old.jpg`)
  assert.equal(res.status, 'saved')
  assert.match(res.url, new RegExp(`^${BASE}${ME}/avatar-\\d+\\.jpg$`))
  const upload = c.calls.find((x) => x[0] === 'upload')
  assert.equal(upload[2], 'image/jpeg')
  assert.deepEqual(c.calls.find((x) => x[0] === 'update').slice(1), ['profiles', { avatar_url: res.url }, ME])
  assert.deepEqual(c.calls.filter((x) => x[0] === 'remove'), [['remove', `${ME}/avatar-old.jpg`]])
})

test('a Google photo is replaced but never "deleted"', async () => {
  const c = fakeClient()
  await saveAvatar(c, ME, blob(10), 'https://lh3.googleusercontent.com/a/photo')
  assert.deepEqual(c.calls.filter((x) => x[0] === 'remove'), [])
})

test('a refused profile update removes the new file and keeps the old one', async () => {
  const c = fakeClient({ updateError: { code: '42501' } })
  const res = await saveAvatar(c, ME, blob(10), `${BASE}${ME}/avatar-old.jpg`)
  assert.equal(res.status, 'failed')
  const removed = c.calls.filter((x) => x[0] === 'remove')
  assert.equal(removed.length, 1)
  assert.notEqual(removed[0][1], `${ME}/avatar-old.jpg`)
})

test('a failed upload changes nothing; an oversized blob is not even sent', async () => {
  const c = fakeClient({ uploadError: { message: 'x' } })
  assert.equal((await saveAvatar(c, ME, blob(10), null)).status, 'failed')
  assert.equal(c.calls.some((x) => x[0] === 'update'), false)
  const c2 = fakeClient()
  assert.equal((await saveAvatar(c2, ME, blob(3 * 1024 * 1024), null)).status, 'tooLarge')
  assert.deepEqual(c2.calls, [])
})

test('removing clears the profile first, then deletes only an own file', async () => {
  const c = fakeClient()
  assert.equal(await removeAvatar(c, ME, `${BASE}${ME}/avatar-9.jpg`), 'saved')
  assert.deepEqual(c.calls.map((x) => x[0]), ['update', 'bucket', 'remove'])
  const c2 = fakeClient({ updateError: { code: 'x' } })
  assert.equal(await removeAvatar(c2, ME, `${BASE}${ME}/avatar-9.jpg`), 'failed')
  assert.equal(c2.calls.some((x) => x[0] === 'remove'), false)
})
