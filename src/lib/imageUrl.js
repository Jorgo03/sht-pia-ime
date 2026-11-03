// Listing photos are uploaded at up to 1600px wide (lib/upload.ts), and a
// card draws them at ~150-320px: a page of 24 results downloaded ~7MB of
// photos to show thumbnails. Supabase's image transformations serve a resized
// copy from /render/image/ instead of /object/, but only on a paid plan, so
// this is switched by EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORMS (off until then).
// Shared by both apps; pure, so tests/imageUrl.test.mjs covers it.

const PUBLIC_OBJECT = '/storage/v1/object/public/'
const PUBLIC_RENDER = '/storage/v1/render/image/public/'
// Widths snap up to a step so a 301px and a 320px card share one cached file.
const STEP = 160

export function thumbnailUrl(url, width, enabled) {
  if (!enabled || !url || typeof url !== 'string') return url
  if (!(width > 0)) return url
  const at = url.indexOf(PUBLIC_OBJECT)
  if (at < 0) return url
  const w = Math.ceil(width / STEP) * STEP
  const rendered = url.slice(0, at) + PUBLIC_RENDER + url.slice(at + PUBLIC_OBJECT.length)
  const sep = rendered.includes('?') ? '&' : '?'
  return `${rendered}${sep}width=${w}&quality=70&resize=cover`
}
