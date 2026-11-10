import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { addImage, getImage } from '../../storage/images'
import { imageStarterConfig, readImageConfig } from './imageConfig'
import { ImageWidget } from './ImageWidget'

function StandaloneImage({ start = {} }: { start?: Record<string, unknown> }) {
  const [config, setConfig] = useState<Record<string, unknown>>({
    ...imageStarterConfig({}),
    ...start,
  })
  return (
    <>
      <ImageWidget
        widget={{ id: 'w1', type: 'image', config }}
        onConfigChange={(_label, next) => setConfig(next)}
        onAddBelow={() => {}}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}

const savedConfig = () => readImageConfig(JSON.parse(screen.getByTestId('config').textContent!))
const pngFile = () =>
  new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], 'cat.png', { type: 'image/png' })
/**
 * The <img> element. Found directly, not by role: with an empty description an
 * image is (correctly) decorative, and decorative images have no "img" role.
 */
const findImg = () =>
  waitFor(() => {
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    return img!
  })
const fileInput = () => document.querySelector('input[type=file]') as HTMLInputElement

describe('ImageWidget', () => {
  it('adds a chosen picture, stores it, and shows it', async () => {
    render(<StandaloneImage />)
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } })

    const img = await findImg()
    expect(img.getAttribute('src')).toMatch(/^blob:/)
    const { imageId } = savedConfig()
    const stored = await getImage(imageId!)
    expect(stored?.type).toBe('image/png')
    expect(stored?.data.byteLength).toBe(7)
  })

  it('refuses a file that is not an image', async () => {
    render(<StandaloneImage />)
    const notes = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [notes] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PNG, JPEG, WebP, or GIF')
    expect(await db.images.count()).toBe(0)
  })

  it('changes the frame and the description in its settings', async () => {
    const stored = await addImage({
      type: 'image/png',
      data: new Uint8Array([1, 2, 3]).buffer,
      width: 40,
      height: 30,
    })
    render(<StandaloneImage start={{ imageId: stored.id }} />)
    await findImg()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Polaroid' }))
    const description = screen.getByRole('textbox', { name: 'Image description' })
    fireEvent.focus(description)
    fireEvent.change(description, { target: { value: 'A sleepy cat' } })
    fireEvent.blur(description)

    expect(savedConfig()).toMatchObject({ frame: 'polaroid', alt: 'A sleepy cat' })
    expect(screen.getByRole('img', { name: 'A sleepy cat' })).toHaveAttribute('width', '40')
  })

  it('replacing a picture keeps the old one stored, so undo can go back', async () => {
    const first = await addImage({
      type: 'image/png',
      data: new Uint8Array([1]).buffer,
      width: null,
      height: null,
    })
    render(<StandaloneImage start={{ imageId: first.id }} />)
    await findImg()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Image' }))
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } })

    await waitFor(() => expect(savedConfig().imageId).not.toBe(first.id))
    expect(await getImage(first.id)).toBeDefined()
  })

  it('says when a stored image is missing', async () => {
    render(<StandaloneImage start={{ imageId: 'gone' }} />)
    expect(await screen.findByText('This image is missing.')).toBeInTheDocument()
  })
})
