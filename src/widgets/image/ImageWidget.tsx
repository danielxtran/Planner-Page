import { useEffect, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react'
import { messageOf } from '../../state/errorStore'
import { addImage, getImage, IMAGE_TYPES } from '../../storage/images'
import { GrowingText } from '../GrowingText'
import { widgetTitle, type WidgetProps } from '../registry'
import { ChoiceButton, OptionRow, StylePanel } from '../StylePanel'
import { FRAMES, readImageConfig, type FrameId, type ImageConfig } from './imageConfig'
import { prepareImage } from './prepareImage'

const ACCEPT = IMAGE_TYPES.join(',')

/** A picture from your computer, with an optional frame (rounded, taped, polaroid) and caption. */
export function ImageWidget({ widget, onConfigChange }: WidgetProps) {
  const config = readImageConfig(widget.config)
  const name = widgetTitle(widget)
  const picture = useImageUrl(config.imageId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function save(label: string, changes: Partial<ImageConfig>) {
    onConfigChange(label, { ...widget.config, ...changes })
  }

  async function addFile(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const stored = await addImage(await prepareImage(file))
      // A new image record each time, so undo can bring back the previous picture.
      save(config.imageId ? 'replace image' : 'add image', { imageId: stored.id })
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  // Dropping or pasting a file works whether or not there's a picture yet (it replaces it).
  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragOver(true)
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      if (!e.dataTransfer.files.length) return
      e.preventDefault()
      setDragOver(false)
      void addFile(e.dataTransfer.files[0])
    },
    onPaste: (e: ClipboardEvent) => {
      const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      void addFile(file)
    },
  }

  const status = busy ? (
    <p role="status" className="mt-2 text-sm text-ink-soft">
      Adding image…
    </p>
  ) : error ? (
    <p role="alert" className="mt-2 rounded-sm bg-rose px-3 py-1.5 text-sm">
      {error}
    </p>
  ) : null

  if (!config.imageId) {
    return (
      <section aria-label={name}>
        <div
          {...dropHandlers}
          // Focusable so you can click it and paste an image with Ctrl+V.
          tabIndex={0}
          aria-label={`${name}: drop or paste an image here`}
          className={`grid place-items-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center focus:border-ink/60 focus:outline-none ${dragOver ? 'border-ink/60 bg-lavender/40' : 'border-ink/25 bg-card/60'}`}
        >
          <span aria-hidden className="text-3xl">
            🖼️
          </span>
          <FileButton onFile={addFile} disabled={busy}>
            Choose an image
          </FileButton>
          <span className="text-sm text-ink-soft">or drop one here, or click here and paste</span>
        </div>
        {status}
      </section>
    )
  }

  return (
    <section aria-label={name} className="group relative">
      <figure
        {...dropHandlers}
        className={dragOver ? 'outline-2 outline-ink/40 outline-dashed' : ''}
      >
        <Framed frame={config.frame}>
          {picture && 'url' in picture ? (
            <img
              src={picture.url}
              alt={config.alt}
              width={picture.width ?? undefined}
              height={picture.height ?? undefined}
              className="block h-auto w-full"
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center bg-paper text-sm text-ink-soft">
              {picture && 'error' in picture ? picture.error : 'Loading…'}
            </div>
          )}
        </Framed>
        {/* An empty caption stays out of sight until you hover or focus, except on a polaroid. */}
        <figcaption
          className={`mt-2 px-1 ${config.frame === 'polaroid' ? 'polaroid-caption' : ''} ${config.caption || config.frame === 'polaroid' ? '' : 'group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100'}`}
        >
          <GrowingText
            value={config.caption}
            onCommit={(caption) => save('edit caption', { caption })}
            label={`${name} caption`}
            placeholder="Add a caption"
            maxLength={200}
            style={{
              fontFamily: 'var(--font-hand)',
              fontSize: '1.45rem',
              textAlign: 'center',
            }}
          />
        </figcaption>
      </figure>
      {status}

      <button
        type="button"
        aria-expanded={editing}
        aria-label={`Edit ${name}`}
        onClick={() => setEditing((e) => !e)}
        className={`absolute -top-3 right-1 z-10 rounded-full border border-ink/25 bg-card px-2.5 py-0.5 text-xs shadow-sm hover:bg-butter ${editing ? '' : 'group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100'}`}
      >
        <span aria-hidden>🖼️ </span>Edit
      </button>

      {editing && (
        <StylePanel label={`Settings for ${name}`} onClose={() => setEditing(false)}>
          <OptionRow label="Frame">
            {FRAMES.map((f) => (
              <ChoiceButton
                key={f.id}
                pressed={config.frame === f.id}
                onClick={() => save('change frame', { frame: f.id })}
              >
                {f.label}
              </ChoiceButton>
            ))}
          </OptionRow>
          <div className="space-y-1">
            <p className="text-ink-soft">
              Description <span className="text-xs">(read aloud by screen readers)</span>
            </p>
            <div className="rounded-sm border border-ink/25 bg-paper px-2 py-1">
              <GrowingText
                value={config.alt}
                onCommit={(alt) => save('edit description', { alt })}
                label="Image description"
                placeholder="e.g. My cat asleep on a pile of notebooks"
                maxLength={300}
                style={{}}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FileButton onFile={addFile} disabled={busy}>
              Replace image
            </FileButton>
            <button
              type="button"
              onClick={() => save('remove image', { imageId: null })}
              className="rounded-full px-3 py-1 text-ink-soft hover:bg-rose hover:text-ink"
            >
              Remove picture
            </button>
          </div>
        </StylePanel>
      )}
    </section>
  )
}

/** The frame around the picture. The looks are CSS classes in index.css. */
function Framed({ frame, children }: { frame: FrameId; children: ReactNode }) {
  if (frame === 'taped') {
    return (
      <div className="relative px-2 pt-2">
        <span aria-hidden className="washi tape-corner tape-corner-left" />
        <span aria-hidden className="washi tape-corner tape-corner-right" />
        <div className="overflow-hidden shadow-[2px_3px_0_rgb(61_53_80/0.12)]">{children}</div>
      </div>
    )
  }
  const frameClass: Record<Exclude<FrameId, 'taped'>, string> = {
    none: '',
    rounded: 'overflow-hidden rounded-xl shadow-[2px_3px_0_rgb(61_53_80/0.12)]',
    polaroid: 'polaroid-frame',
  }
  return <div className={frameClass[frame]}>{children}</div>
}

/** A button that opens the file picker. A real (hidden) file input keeps it keyboard-accessible. */
function FileButton({
  onFile,
  disabled,
  children,
}: {
  onFile: (file: File | undefined) => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <label
      className={`cursor-pointer rounded-full border border-ink/30 bg-butter px-3 py-1 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-butter/70 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      {children}
      <input
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          // Clear it, so picking the same file again still counts as a change.
          e.target.value = ''
        }}
      />
    </label>
  )
}

type Picture =
  | { id: string; url: string; width: number | null; height: number | null }
  | { id: string; error: string }

/**
 * Loads a stored image and gives back a temporary `blob:` URL for <img>. The URL
 * is released when the image changes or the widget goes away, so memory isn't leaked.
 */
function useImageUrl(imageId: string | null): Picture | null {
  const [picture, setPicture] = useState<Picture | null>(null)

  useEffect(() => {
    if (!imageId) return
    let current = true
    let url: string | undefined
    getImage(imageId).then(
      (image) => {
        if (!current) return
        if (!image) {
          setPicture({ id: imageId, error: 'This image is missing.' })
          return
        }
        url = URL.createObjectURL(new Blob([image.data], { type: image.type }))
        setPicture({ id: imageId, url, width: image.width, height: image.height })
      },
      (e: unknown) => current && setPicture({ id: imageId, error: messageOf(e) }),
    )
    return () => {
      current = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [imageId])

  return picture?.id === imageId ? picture : null
}
