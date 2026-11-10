import { describe, expect, it } from 'vitest'
import { db } from './db'
import { addImage, getImage, MAX_IMAGE_BYTES } from './images'
import { LOCAL_USER_ID } from './user'

const bytes = (n: number) => new Uint8Array(n).fill(7).buffer

describe('images', () => {
  it('stores an image and reads it back byte for byte', async () => {
    const saved = await addImage({ type: 'image/webp', data: bytes(10), width: 4, height: 3 })
    expect(saved).toMatchObject({ userId: LOCAL_USER_ID, type: 'image/webp', width: 4, height: 3 })

    const loaded = await getImage(saved.id)
    expect(new Uint8Array(loaded!.data)).toEqual(new Uint8Array(bytes(10)))
  })

  it.each([
    ['an unsupported type', { type: 'image/svg+xml', data: bytes(10) }, 'Use a PNG'],
    ['empty data', { type: 'image/png', data: bytes(0) }, 'empty'],
    ['too many bytes', { type: 'image/png', data: bytes(MAX_IMAGE_BYTES + 1) }, 'too large'],
  ])('rejects %s', async (_name, image, message) => {
    await expect(addImage({ width: null, height: null, ...image })).rejects.toThrow(message)
    expect(await db.images.count()).toBe(0)
  })

  it("doesn't return another user's image", async () => {
    const saved = await addImage({ type: 'image/png', data: bytes(1), width: null, height: null })
    await db.images.add({ ...saved, id: 'theirs', userId: 'someone-else' })
    expect(await getImage('theirs')).toBeUndefined()
  })
})
