export const FRAMES = [
  { id: 'none', label: 'None' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'taped', label: 'Taped' },
  { id: 'polaroid', label: 'Polaroid' },
] as const

export type FrameId = (typeof FRAMES)[number]['id']

/** An image widget's saved settings. The picture itself is in the images table. */
export interface ImageConfig {
  /** null until a picture is chosen. */
  imageId: string | null
  /** Read aloud by screen readers. Empty means the image is decorative. */
  alt: string
  caption: string
  frame: FrameId
}

const DEFAULTS: ImageConfig = { imageId: null, alt: '', caption: '', frame: 'rounded' }

export const IMAGE_STARTERS: {
  label: string
  description: string
  config: Partial<ImageConfig>
}[] = [
  { label: 'Image', description: 'A picture from your computer.', config: { frame: 'rounded' } },
  {
    label: 'Polaroid photo',
    description: 'A photo in a white instant-film frame with a handwritten caption.',
    config: { frame: 'polaroid' },
  },
  {
    label: 'Taped photo',
    description: 'A photo stuck on with washi tape at the corners.',
    config: { frame: 'taped' },
  },
]

export function readImageConfig(config: Record<string, unknown>): ImageConfig {
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.slice(0, max) : ''
  return {
    imageId: typeof config.imageId === 'string' && config.imageId ? config.imageId : null,
    alt: text(config.alt, 300),
    caption: text(config.caption, 200),
    frame: FRAMES.some((f) => f.id === config.frame) ? (config.frame as FrameId) : DEFAULTS.frame,
  }
}

export function imageStarterConfig(changes: Partial<ImageConfig>): ImageConfig {
  return { ...DEFAULTS, ...changes }
}
