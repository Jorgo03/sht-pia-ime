import { AVATAR_SIZE_PX } from './avatar.js'

/**
 * Browser only: centre-crop a picked image to a square and re-encode it as a
 * JPEG of AVATAR_SIZE_PX. Re-encoding also drops EXIF (including GPS) from the
 * upload. Resolves null if the browser cannot decode the file.
 */
export function resizeToSquareJpeg(file, size = AVATAR_SIZE_PX, quality = 0.85) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, size, size,
      )
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
