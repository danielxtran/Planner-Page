import type { ButtonHTMLAttributes, Ref } from 'react'

interface DragHandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * The grip you drag rows and widgets by. Dragging only from a handle (not the
 * whole widget) keeps clicks and text selection inside widgets working in edit mode.
 */
export function DragHandle({ label, ref, ...rest }: DragHandleProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      // touch-none stops a finger drag from scrolling the page instead of moving the item.
      className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-ink-soft hover:bg-card hover:text-ink active:cursor-grabbing"
      {...rest}
    >
      <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5 fill-current">
        {[3, 8, 13].flatMap((y) => [
          <circle key={`l${y}`} cx="2.5" cy={y} r="1.5" />,
          <circle key={`r${y}`} cx="7.5" cy={y} r="1.5" />,
        ])}
      </svg>
    </button>
  )
}
