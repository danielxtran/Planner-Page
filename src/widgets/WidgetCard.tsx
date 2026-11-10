import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Washi tape colors. Each is a theme color, so tape follows the theme. */
export type TapeColor = 'lavender' | 'mint' | 'peach' | 'sky' | 'rose' | 'butter'

interface WidgetCardProps {
  /** What the heading shows. */
  title: string
  /** Shown when the title is cleared; clearing a title goes back to this. */
  defaultTitle: string
  /** Saves a new title; '' means "use the default". */
  onRename: (title: string) => void
  tape: TapeColor
  /** Small text at the right of the header, like "2 of 5 done". */
  aside?: ReactNode
  children: ReactNode
}

/**
 * The paper card every widget sits on: a washi-tape strip, a handwritten
 * heading you can rename in place, and the widget's content. Its look comes
 * from the `widget-card` and `washi` classes in index.css, so themes can restyle it.
 */
export function WidgetCard({
  title,
  defaultTitle,
  onRename,
  tape,
  aside,
  children,
}: WidgetCardProps) {
  const headingId = useId()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(title)
  const renameButton = useRef<HTMLButtonElement>(null)
  // Enter saves and then the input unmounts, which fires blur too; only the first counts.
  const finished = useRef(false)

  function startRenaming() {
    finished.current = false
    setDraft(title)
    setRenaming(true)
  }

  function finish(save: boolean) {
    if (finished.current) return
    finished.current = true
    setRenaming(false)
    const next = draft.trim()
    if (save && next !== title) onRename(next === defaultTitle ? '' : next)
    // Back to the pencil, so keyboard users don't lose their place.
    setTimeout(() => renameButton.current?.focus())
  }

  return (
    <section
      aria-labelledby={headingId}
      className="widget-card relative rounded-sm p-5 pt-7"
      style={{ '--tape': `var(--color-${tape})` } as CSSProperties}
    >
      {/* Washi tape strip, purely decorative. */}
      <div
        aria-hidden
        className="washi absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2"
      />

      <header className="group mb-3 flex items-baseline justify-between gap-2">
        {renaming ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finish(true)
              if (e.key === 'Escape') finish(false)
            }}
            onBlur={() => finish(true)}
            aria-label="Widget title"
            placeholder={defaultTitle}
            maxLength={60}
            className="min-w-0 flex-1 rounded-sm border-2 border-ink/50 bg-paper px-2 font-hand text-3xl font-bold focus:outline-none"
          />
        ) : (
          <div className="flex min-w-0 items-baseline gap-1">
            <h2 id={headingId} className="font-hand text-3xl font-bold break-words">
              {title}
            </h2>
            {/* Hidden until hover/focus on mouse devices; always there on touch screens. */}
            <button
              ref={renameButton}
              type="button"
              onClick={startRenaming}
              aria-label={`Rename "${title}"`}
              className="grid size-7 shrink-0 place-items-center self-center rounded-full text-ink-soft group-focus-within:opacity-100 hover:bg-butter hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
                <path
                  d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
        {aside && <div className="shrink-0 text-sm text-ink-soft">{aside}</div>}
      </header>

      {children}
    </section>
  )
}
