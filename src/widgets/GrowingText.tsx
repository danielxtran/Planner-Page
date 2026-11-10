import { useRef, useState, type CSSProperties } from 'react'

interface GrowingTextProps {
  value: string
  onCommit: (value: string) => void
  label: string
  placeholder: string
  maxLength: number
  style: CSSProperties
  /** Sizes to its words instead of filling the line (for the attribution). */
  inline?: boolean
}

/**
 * A textarea that grows with its text. It sits on top of an invisible copy of
 * the same text in one grid cell, so the copy sets the size; no measuring code.
 * Typing stays local until you leave the box, then saves once, so the hub's
 * undo gets one step per edit while Ctrl+Z inside the box still undoes typing.
 */
export function GrowingText({
  value,
  onCommit,
  label,
  placeholder,
  maxLength,
  style,
  inline,
}: GrowingTextProps) {
  // null = not editing, so the saved value shows (and an undo elsewhere shows up here).
  const [draft, setDraft] = useState<string | null>(null)
  // Escape blurs the box; the blur must then skip saving. (The `draft` the blur
  // handler sees is from the last render, so clearing state alone isn't enough.)
  const cancelled = useRef(false)
  const shown = draft ?? value

  function finish() {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft)
    cancelled.current = false
    setDraft(null)
  }

  return (
    <div className={`${inline ? 'inline-grid' : 'grid'} max-w-full`} style={style}>
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 leading-snug break-words whitespace-pre-wrap"
      >
        {/* The trailing space keeps a final empty line from collapsing. */}
        {(shown || placeholder) + ' '}
      </span>
      <textarea
        value={shown}
        rows={1}
        onFocus={() => setDraft(value)}
        onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // Escape throws away this edit, like cancelling.
            cancelled.current = true
            e.currentTarget.blur()
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck
        className="col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent leading-snug break-words placeholder:text-ink-soft focus:outline-2 focus:outline-offset-2 focus:outline-ink/30 focus:outline-dashed"
        style={{ font: 'inherit', color: 'inherit', textAlign: 'inherit' }}
      />
    </div>
  )
}
