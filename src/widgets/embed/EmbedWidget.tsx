import { useState, type FormEvent } from 'react'
import { widgetTitle, type WidgetProps } from '../registry'
import { EMBED_PROVIDERS, toEmbed } from './embeds'

/** A video, playlist, map, or public calendar from a supported site, shown inside the hub. */
export function EmbedWidget({ widget, onConfigChange }: WidgetProps) {
  const url = typeof widget.config.url === 'string' ? widget.config.url : ''
  const embed = url ? toEmbed(url) : null
  const name = widgetTitle(widget)
  const [changing, setChanging] = useState(false)

  if (!embed || changing) {
    return (
      <section aria-label={name}>
        <EmbedForm
          initial={url}
          onSave={(next) => {
            onConfigChange(url ? 'change embed' : 'add embed', { ...widget.config, url: next })
            setChanging(false)
          }}
          onCancel={embed ? () => setChanging(false) : undefined}
        />
      </section>
    )
  }

  return (
    <section aria-label={name} className="group relative">
      <div
        className="overflow-hidden rounded-md shadow-[2px_3px_0_rgb(61_53_80/0.12)]"
        style={embed.aspect ? { aspectRatio: String(embed.aspect) } : { height: embed.height }}
      >
        <iframe
          src={embed.src}
          title={`${embed.provider} embed`}
          loading="lazy"
          // The sandbox lets the player run, but stops it from navigating the hub
          // away or starting downloads. Popups are allowed so "Watch on YouTube" works.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          allow="encrypted-media; picture-in-picture; fullscreen; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block size-full border-0"
        />
      </div>
      <button
        type="button"
        onClick={() => setChanging(true)}
        aria-label={`Change ${name} link`}
        className="absolute -top-3 right-1 rounded-full border border-ink/25 bg-card px-2.5 py-0.5 text-xs shadow-sm group-focus-within:opacity-100 hover:bg-butter pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
      >
        Change link
      </button>
    </section>
  )
}

function EmbedForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (url: string) => void
  onCancel?: () => void
}) {
  const [value, setValue] = useState(initial)
  const [invalid, setInvalid] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!toEmbed(value)) {
      setInvalid(true)
      return
    }
    onSave(value.trim())
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Embed link"
      className="space-y-2 rounded-sm border-2 border-dashed border-ink/25 bg-card/60 p-4 text-sm"
    >
      <p className="font-hand text-2xl">Embed something</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setInvalid(false)
          }}
          aria-label="Link to embed"
          aria-invalid={invalid}
          placeholder="Paste a YouTube, Spotify, or Maps link"
          className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-3 py-1 focus:border-ink/60 focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-mint px-3 py-1 hover:bg-mint/70">
          Embed
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1 text-ink-soft hover:bg-paper hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
      {invalid && (
        <p role="alert" className="rounded-sm bg-rose px-2 py-1">
          That link can't be embedded.
        </p>
      )}
      <p className="text-xs text-ink-soft">
        Works with {EMBED_PROVIDERS.join(', ')}. For Maps and Google Calendar, use their "Embed"
        link.
      </p>
    </form>
  )
}
