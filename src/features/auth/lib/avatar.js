// Profile photo rules, shared by the website and the phone app
// (docs/LAUNCH_TASKS.md F12).
//
// Photos live in the public `avatars` bucket under `<user id>/`. The bucket
// itself allows 2 MB of JPEG/PNG/WebP, storage policies keep each user in
// their own folder, and the database (migration 20261021003934) refuses an
// avatar_url that points anywhere else. The apps resize to a small JPEG first,
// so the 2 MB ceiling is never what a person runs into.

import { removedMediaPaths } from '../../listings/lib/listingForm.js'

export const AVATAR_BUCKET = 'avatars'
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
/** What a person may pick. Larger files are fine: they are resized first. */
export const AVATAR_SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_SOURCE_MAX_BYTES = 15 * 1024 * 1024
export const AVATAR_SIZE_PX = 512

/** 'type' | 'size' | null for a file the person picked, before resizing. */
export function avatarSourceError({ type, size } = {}) {
  if (type && !AVATAR_SOURCE_TYPES.includes(type)) return 'type'
  if (typeof size === 'number' && size > AVATAR_SOURCE_MAX_BYTES) return 'size'
  return null
}

/** Storage path for a new photo. Always JPEG: both apps re-encode before upload. */
export function newAvatarPath(userId, now = Date.now()) {
  return `${userId}/avatar-${now}.jpg`
}

/** The storage path of `url` if it is the user's own uploaded photo, else null. */
export function ownAvatarPath(url, userId) {
  return removedMediaPaths({ before: [url], after: [], userId, bucket: AVATAR_BUCKET })[0] ?? null
}

/** Size of a Blob (website) or an ArrayBuffer (phone app), or null. */
export function bodySize(body) {
  if (!body) return null
  if (typeof body.size === 'number') return body.size
  if (typeof body.byteLength === 'number') return body.byteLength
  return null
}

/**
 * Upload a resized JPEG and point the profile at it.
 * `body` is a Blob on the website and an ArrayBuffer in the phone app: a
 * React Native Blob is sent as text/plain, which the bucket refuses.
 * Returns { status: 'saved', url } or { status: 'failed' | 'tooLarge' }.
 * Never leaves a half-done change: if the profile update fails, the new file
 * is removed; the old photo is removed only after the update succeeded.
 */
export async function saveAvatar(client, userId, body, previousUrl) {
  const size = bodySize(body)
  if (!size) return { status: 'failed' }
  if (size > AVATAR_MAX_BYTES) return { status: 'tooLarge' }
  const bucket = client.storage.from(AVATAR_BUCKET)
  const path = newAvatarPath(userId)
  try {
    const { error: uploadError } = await bucket.upload(path, body, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) return { status: 'failed' }
    const url = bucket.getPublicUrl(path).data.publicUrl
    const { error } = await client.from('profiles').update({ avatar_url: url }).eq('id', userId)
    if (error) {
      await bucket.remove([path]).catch(() => {})
      return { status: 'failed' }
    }
    const old = ownAvatarPath(previousUrl, userId)
    if (old && old !== path) await bucket.remove([old]).catch(() => {})
    return { status: 'saved', url }
  } catch {
    return { status: 'failed' }
  }
}

/** Remove the photo: 'saved' | 'failed'. A Google photo is just unlinked. */
export async function removeAvatar(client, userId, previousUrl) {
  try {
    const { error } = await client.from('profiles').update({ avatar_url: null }).eq('id', userId)
    if (error) return 'failed'
    const old = ownAvatarPath(previousUrl, userId)
    if (old) await client.storage.from(AVATAR_BUCKET).remove([old]).catch(() => {})
    return 'saved'
  } catch {
    return 'failed'
  }
}
