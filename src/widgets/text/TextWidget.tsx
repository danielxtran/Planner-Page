import { useState, type CSSProperties } from 'react'
import { GrowingText } from '../GrowingText'
import { widgetTitle, type WidgetProps } from '../registry'
import { MAX_TEXT_LENGTH, readTextConfig, type TextConfig } from './textConfig'
import { backgroundCss, fontSizeCss, FONTS, TEXT_COLORS, type VariantId } from './textStyles'
import { TextStylePanel } from './TextStylePanel'

const PLACEHOLDERS: Record<VariantId, string> = {
  text: 'Write something…',
  quote: 'Type a quote…',
  callout: 'Something to remember…',
  label: 'Label',
  sticky: 'Note to self…',
}

/**
 * A styled block of text: plain, quote, callout, cut-out label, or sticky note.
 * You type straight into it; the text saves when you click away (one undo step
 * per edit), and the Style panel changes its look.
 */
export function TextWidget({ widget, onConfigChange }: WidgetProps) {
  const config = readTextConfig(widget.config)
  const name = widgetTitle(widget)
  const [styling, setStyling] = useState(false)

  function save(label: string, changes: Partial<TextConfig>) {
    onConfigChange(label, { ...widget.config, ...changes })
  }

  const font = FONTS.find((f) => f.id === config.font) ?? FONTS[0]
  const textStyle: CSSProperties = {
    fontFamily: font.family,
    fontSize: fontSizeCss(config.font, config.size),
    color: TEXT_COLORS.find((c) => c.id === config.color)?.css,
    textAlign: config.align,
  }
  const background = backgroundCss(config.background)

  const body = (
    <GrowingText
      value={config.text}
      onCommit={(text) => save('edit text', { text })}
      label={`${name} text`}
      placeholder={PLACEHOLDERS[config.variant]}
      maxLength={MAX_TEXT_LENGTH}
      style={textStyle}
    />
  )

  return (
    <section aria-label={name} className="group relative">
      {config.variant === 'quote' && (
        <figure className="rounded-sm px-4 py-3" style={{ backgroundColor: background }}>
          <span
            aria-hidden
            className="block h-8 font-serif text-6xl leading-none opacity-40"
            style={{ color: textStyle.color, textAlign: config.align }}
          >
            “
          </span>
          <blockquote>{body}</blockquote>
          <figcaption className="mt-1 flex" style={{ justifyContent: alignToFlex(config.align) }}>
            <span aria-hidden className="mr-1 text-ink-soft">
              —
            </span>
            <GrowingText
              value={config.attribution}
              onCommit={(attribution) => save('edit attribution', { attribution })}
              label={`${name} attribution`}
              placeholder="who said it"
              maxLength={200}
              style={{ fontFamily: font.family, color: 'var(--color-ink-soft)' }}
              inline
            />
          </figcaption>
        </figure>
      )}

      {config.variant === 'callout' && (
        <div
          className="flex gap-3 rounded-md border border-ink/15 px-4 py-3"
          style={{ backgroundColor: background }}
        >
          <span aria-hidden className="text-2xl leading-none">
            {config.icon}
          </span>
          <div className="min-w-0 flex-1">{body}</div>
        </div>
      )}

      {config.variant === 'label' && (
        <div style={{ textAlign: config.align }}>
          {/* inline-block so the strip is only as wide as its words. */}
          <div
            className="cutout-label inline-block max-w-full px-5 py-2"
            style={{ backgroundColor: background ?? 'var(--color-card)' }}
          >
            {body}
          </div>
        </div>
      )}

      {config.variant === 'sticky' && (
        <div
          className="sticky-note min-h-36 rounded-sm px-4 pt-6 pb-4"
          style={{ backgroundColor: background ?? 'var(--color-butter)' }}
        >
          {body}
        </div>
      )}

      {config.variant === 'text' && (
        <div
          className={background ? 'rounded-sm px-4 py-3' : 'px-1'}
          style={{ backgroundColor: background }}
        >
          {body}
        </div>
      )}

      {/* Shown on hover/focus with a mouse, always on touch screens, like the other widget buttons. */}
      <button
        type="button"
        aria-expanded={styling}
        aria-label={`Style ${name}`}
        onClick={() => setStyling((s) => !s)}
        className={`absolute -top-3 right-1 rounded-full border border-ink/25 bg-card px-2.5 py-0.5 text-xs shadow-sm hover:bg-butter ${styling ? '' : 'group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100'}`}
      >
        <span aria-hidden>🎨 </span>Style
      </button>

      {styling && (
        <TextStylePanel
          config={config}
          name={name}
          onChange={(changes) => save('change style', changes)}
          onClose={() => setStyling(false)}
        />
      )}
    </section>
  )
}

function alignToFlex(align: TextConfig['align']) {
  return align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
}
