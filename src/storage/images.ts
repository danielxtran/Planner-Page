import { db } from './db'
import { LOCAL_USER_ID } from './user'

/** Image types the hub accepts. SVG is left out: it's a document, not just a picture. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type ImageType = (typeof IMAGE_TYPES)[number]

/** Upper limit per stored image, after resizing. Keeps one photo from filling the browser's storage. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * An uploaded picture. The bytes are kept as an ArrayBuffer rather than a Blob:
 * every browser (and the in-memory database used in tests) can store an
 * ArrayBuffer, while Blob support in IndexedDB has been patchy, notably in older Safari.
 */
export interface StoredImage {
  id: string
  userId: string
  type: ImageType
  data: ArrayBuffer
  /** Pixel size, when known. Lets the page reserve the right space before the image draws. */
  width: number | null
  height: number | null
  createdAt: string
  updatedAt: string
}

export interface NewImage {
  type: string
  data: ArrayBuffer
  width: number | null
  height: number | null
}

/**
 * Saves a new image and returns it. Images are never changed after saving:
 * replacing a widget's picture saves a new one, so undo can switch back to the old.
 */
export async function addImage(image: NewImage): Promise<StoredImage> {
  if (!IMAGE_TYPES.includes(image.type as ImageType)) {
    throw new Error('Use a PNG, JPEG, WebP, or GIF image')
  }
  // Not `instanceof`: buffers made in another window or iframe fail that test even when valid.
  const isBuffer = Object.prototype.toString.call(image.data) === '[object ArrayBuffer]'
  if (!isBuffer || image.data.byteLength === 0) {
    throw new Error('The image is empty')
  }
  if (image.data.byteLength > MAX_IMAGE_BYTES)
    throw new Error('That image is too large (over 5 MB)')
  const now = new Date().toISOString()
  const stored: StoredImage = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER_ID,
    type: image.type as ImageType,
    data: image.data,
    width: image.width,
    height: image.height,
    createdAt: now,
    updatedAt: now,
  }
  await db.images.add(stored)
  return stored
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const image = await db.images.get(id)
  return image?.userId === LOCAL_USER_ID ? image : undefined
}
