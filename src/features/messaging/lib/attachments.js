// Photos and documents in chats: what may be sent, where it is stored and how
// it is described. Shared and pure, for `npm test`; the phone app imports it
// through attachments.d.ts.
//
// The database and the private bucket enforce the same list and limit
// (migration 20261111234947_message_attachments.sql), so a request sent
// around the app is refused too. A stored file is named
// <conversation id>/<time>-<random>.<ext>: the conversation's own folder, which
// only its two participants can read, and an extension taken from the checked
// type, never from the person's file name ("cv.pdf.exe" sent as a PDF is .pdf).

export const MAX_ATTACHMENT_MB = 10
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024

export const ATTACHMENT_TYPES = Object.freeze({
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'application/msword': { ext: 'doc', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', kind: 'file' },
  'application/vnd.ms-excel': { ext: 'xls', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', kind: 'file' },
  'text/plain': { ext: 'txt', kind: 'file' },
})

/** What the document picker offers: every type above. */
export const DOCUMENT_PICKER_TYPES = Object.freeze(Object.keys(ATTACHMENT_TYPES))

const BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

/**
 * The file's type: the one it reports when that is allowed, else the one its
 * extension names. Pickers report Office files and plain text inconsistently
 * ("application/octet-stream", nothing at all), so the name is the fallback;
 * the bucket still checks what is actually uploaded.
 */
export function attachmentType(mime, name) {
  const reported = String(mime ?? '').toLowerCase().split(';')[0].trim()
  if (has(ATTACHMENT_TYPES, reported)) return reported
  const ext = String(name ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext && has(BY_EXTENSION, ext) ? BY_EXTENSION[ext] : null
}

/** Why a file cannot be sent ('type' or 'size'), or null when it can. */
export function checkAttachment({ mime, name, size }) {
  if (!attachmentType(mime, name)) return 'type'
  if (typeof size === 'number' && (size <= 0 || size > MAX_ATTACHMENT_BYTES)) return 'size'
  return null
}

/** The storage path for a file in this conversation. Throws when it cannot be sent. */
export function attachmentPath(conversationId, mime, { now = Date.now(), random = Math.random().toString(36).slice(2) } = {}) {
  if (!UUID.test(String(conversationId))) throw new Error('attachment needs the conversation id')
  if (!has(ATTACHMENT_TYPES, mime)) throw new Error(`file type not allowed: ${mime}`)
  const token = String(random).toLowerCase().replace(/[^a-z0-9]/g, '') || 'f'
  return `${String(conversationId).toLowerCase()}/${Math.floor(now)}-${token}.${ATTACHMENT_TYPES[mime].ext}`
}

/**
 * The name shown in the chat: the person's own file name without folders or
 * control characters, at most 120 characters with its extension kept; a plain
 * "photo.jpg"-style name when there is none.
 */
export function displayName(name, mime, fallback = 'file') {
  const ext = has(ATTACHMENT_TYPES, mime) ? ATTACHMENT_TYPES[mime].ext : ''
  let base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  // Control characters and the bidi overrides that can disguise an extension.
  base = base.replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').trim()
  if (!base) return ext ? `${fallback}.${ext}` : fallback
  if (base.length <= 120) return base
  const dot = base.lastIndexOf('.')
  const tail = dot > 0 && base.length - dot <= 6 ? base.slice(dot) : ''
  return `${base.slice(0, 120 - tail.length - 1)}…${tail}`
}

/** What the message row records about its file. */
export function attachmentRecord({ path, name, mime, size }) {
  return { path, name, mime, size, kind: ATTACHMENT_TYPES[mime]?.kind ?? 'file' }
}

/** A received row's attachment when it is well formed, else null. */
export function readAttachment(value) {
  if (!value || typeof value !== 'object') return null
  const { path, name, mime, size } = value
  if (typeof path !== 'string' || !has(ATTACHMENT_TYPES, mime)) return null
  return {
    path,
    name: typeof name === 'string' && name.trim() ? name : displayName('', mime),
    mime,
    size: typeof size === 'number' && size > 0 ? size : null,
    kind: ATTACHMENT_TYPES[mime].kind,
  }
}

/** "820 KB", "2.4 MB": how big a file is, for the chat. */
export function formatBytes(bytes, locale = 'en') {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return ''
  const fmt = (n, digits) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)
  if (bytes < 1024) return `${fmt(bytes, 0)} B`
  if (bytes < 1024 * 1024) return `${fmt(Math.max(1, Math.round(bytes / 1024)), 0)} KB`
  return `${fmt(bytes / (1024 * 1024), 1)} MB`
}
