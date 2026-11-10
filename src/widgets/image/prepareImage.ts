import { IMAGE_TYPES, MAX_IMAGE_BYTES, type NewImage } from '../../storage/images'

/** Longest side after resizing. Plenty for a widget, and keeps phone photos (often 4000px+) small. */
export const MAX_IMAGE_SIDE = 1600

/** Files bigger than this are refused before even trying to resize them. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

/**
 * Turns a chosen file into an image ready to save: checks its type, and
 * shrinks big photos so they don't eat the browser's storage. GIFs are kept
 * as they are, since redrawing one would lose its animation.
 */
export async function prepareImage(file: File): Promise<NewImage> {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    throw new Error('Use a PNG, JPEG, WebP, or GIF image')
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('That file is too large (over 25 MB)')

  const original = async (): Promise<NewImage> => ({
    type: file.type,
    data: await file.arrayBuffer(),
    width: null,
    height: null,
  })

  // createImageBitmap is missing in some older browsers (and in the test environment).
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') {
    const image = await original()
    if (image.data.byteLength > MAX_IMAGE_BYTES)
      throw new Error('That image is too large (over 5 MB)')
    return image
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("Couldn't read that image. Is the file damaged?")
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  // Small enough already: keep the original bytes, so nothing is recompressed.
  if (scale === 1 && file.size <= MAX_IMAGE_BYTES) {
    bitmap.close()
    return { ...(await original()), width, height }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error("Couldn't resize that image")
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  // WebP keeps transparency and is small. A browser that can't write WebP
  // hands back a PNG instead, which is still a type we accept.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  )
  if (!blob) throw new Error("Couldn't resize that image")
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('That image is too large, even after resizing')
  return { type: blob.type, data: await blob.arrayBuffer(), width, height }
}
