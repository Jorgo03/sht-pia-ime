// Photo preparation and upload rules shared by the listing wizard and the
// profile photo (lib/upload.ts does the native I/O; this file is pure so
// `npm test` can run it under Node).
//
// Two failures seen live on 2026-10-21 shaped it:
// 1. Storage refused every upload from the phone with "mime type text/plain is
//    not supported": a React Native Blob sent through FormData arrives as
//    text/plain, and the contentType option is ignored for FormData bodies.
//    Uploading the bytes (an ArrayBuffer) sends the real Content-Type, which
//    is what Supabase's own Expo example does.
// 2. Expo Go 57.0.9 ships an older native image manipulator whose
//    orientation step cannot draw 10-bit HDR photos ("Image context has been
//    lost"). The picker now asks iOS for its most compatible (8-bit JPEG)
//    copy, and if processing still fails, an original that already meets the
//    bucket's type and size rules may be uploaded instead. Nothing is ever
//    skipped silently.

export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Error tagged with the stage that failed, so the UI can say which. */
export function uploadError(stage, cause) {
  const err = new Error(`${stage}_failed`)
  err.stage = stage
  // Kept for the UI's tests and the dev log; never shown to the person.
  err.cause = cause
  if (stage === 'upload') err.uploadFailed = true
  return err
}

/**
 * What to upload for one photo: the processed JPEG, or, when processing
 * failed, the original if it is already an allowed type within the limit.
 * Throws a 'prepare' error otherwise.
 */
export function chooseUploadSource({ processed, failure, original, maxBytes }) {
  if (processed) return { uri: processed, contentType: 'image/jpeg', ext: 'jpg', fallback: false }
  const type = String(original?.mimeType ?? '').toLowerCase()
  const size = typeof original?.size === 'number' ? original.size : null
  const usable = original?.uri && UPLOAD_IMAGE_TYPES.includes(type) && size !== null && size > 0 && size <= maxBytes
  if (!usable) throw uploadError('prepare', failure)
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return { uri: original.uri, contentType: type, ext, fallback: true }
}

/** The file's bytes for upload; an empty read is a failure, not an upload. */
export async function readBytes(fetchImpl, uri) {
  let buffer
  try {
    buffer = await (await fetchImpl(uri)).arrayBuffer()
  } catch (cause) {
    throw uploadError('read', cause)
  }
  if (!buffer || !buffer.byteLength) throw uploadError('read', new Error('empty file'))
  return buffer
}

/**
 * Prepares and uploads items one by one, in order. All or nothing: if any
 * item fails, the ones already uploaded are removed and the error says which
 * stage failed. `prepare(item)` → { uri, contentType, ext }; `upload(source,
 * bytes)` → path; `remove(paths)` cleans up.
 */
export async function uploadAllOrNothing({ items, prepare, read, upload, remove, onProgress }) {
  const paths = []
  try {
    for (const item of items) {
      const source = await prepare(item)
      const bytes = await read(source.uri)
      let path
      try {
        path = await upload(source, bytes)
      } catch (cause) {
        throw cause?.stage ? cause : uploadError('upload', cause)
      }
      paths.push(path)
      onProgress?.(paths.length, items.length)
    }
    return paths
  } catch (err) {
    if (paths.length) await Promise.resolve(remove(paths)).catch(() => {})
    throw err?.stage ? err : uploadError('prepare', err)
  }
}

/** Postgres unique violation: a retried insert whose first attempt landed. */
export function isDuplicateKey(error) {
  return error?.code === '23505'
}
