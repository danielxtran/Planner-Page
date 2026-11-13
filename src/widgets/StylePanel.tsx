import type { CSSProperties, ReactNode } from 'react'

/**
 * Building blocks for a widget's settings panel (text styles, image frames).
 * Every choice is a toggle button with aria-pressed, so keyboards and screen
 * readers get the same controls as a mouse, and "selected" shows a ✓, not just color.
 */

export function StylePanel({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="mt-2 space-y-2.5 rounded-sm border border-dashed border-ink/25 bg-card p-3 text-sm shadow-[2px_3px_0_rgb(61_53_80/0.08)]"
    >
      {children}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-mint px-3 py-1 hover:bg-mint/70"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {/* Its own line in a narrow widget, a fixed-width label column when there's room. */}
      <span aria-hidden className="w-full shrink-0 text-ink-soft @2xs:w-20">
        {label}
      </span>
      {children}
    </div>
  )
}

export function ChoiceButton({
  pressed,
  onClick,
  label,
  style,
  children,
}: {
  pressed: boolean
  onClick: () => void
  /** Accessible name, when the visible content isn't a good one. */
  label?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      style={style}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${pressed ? 'border-ink/60 bg-lavender' : 'border-dashed border-ink/30 hover:bg-paper'}`}
    >
      {pressed && <span aria-hidden>✓</span>}
      {children}
    </button>
  )
}

/** A round color sample. `color` undefined draws "none" (a slash). */
export function SwatchButton({
  pressed,
  onClick,
  label,
  color,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  color: string | undefined
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative grid size-7 place-items-center rounded-full border-2 ${pressed ? 'border-ink' : 'border-ink/20 hover:border-ink/50'}`}
      style={{
        backgroundColor: color,
        backgroundImage: color
          ? undefined
          : 'linear-gradient(135deg, transparent 45%, rgb(61 53 80 / 0.5) 45% 55%, transparent 55%)',
      }}
    >
      {pressed && (
        <span aria-hidden className="text-xs font-bold text-ink mix-blend-normal">
          ✓
        </span>
      )}
    </button>
  )
}
