// What the apps may upload, and the name each file gets in storage
// (AUDIT.md Pass 37). The storage buckets enforce the same list and the size
// limits on the server (avatars: JPEG/PNG/WebP, 2 MB; property-images: these
// types, 50 MB), so a request sent around the app is refused too.
//
// A stored file is named <user id>/<prefix><time>-<random>.<ext>, and the
// extension comes from the checked file type, never from the person's own
// file name: "photo.html" sent as a JPEG is stored as ".jpg".

export const UPLOAD_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
})

/** The extension for an allowed type, or null for anything else. */
export function extensionFor(mime) {
  return Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, mime) ? UPLOAD_TYPES[mime] : null
}

/** The storage path for a new upload. Throws for a type that is not allowed. */
export function uploadPath(userId, mime, { prefix = '', now = Date.now(), random = Math.random().toString(36).slice(2) } = {}) {
  const ext = extensionFor(mime)
  if (!ext) throw new Error(`file type not allowed: ${mime}`)
  if (!/^[0-9a-f-]{36}$/i.test(String(userId))) throw new Error('upload needs the signed-in account id')
  return `${userId}/${prefix}${now}-${String(random).replace(/[^a-z0-9]/gi, '')}.${ext}`
}
