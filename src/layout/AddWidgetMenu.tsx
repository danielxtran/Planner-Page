import { useId, useState } from 'react'
import { WIDGET_DEFINITIONS } from '../widgets/registry'

interface AddWidgetMenuProps {
  /** Which column this is, for the button's accessible name. */
  label: string
  onAdd: (type: string) => void
}

/** "+ Add widget" at the bottom of a column, opening a list of every widget type. */
export function AddWidgetMenu({ label, onAdd }: AddWidgetMenuProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Add widget to ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-sm border border-dashed border-ink/30 px-3 py-1.5 text-sm text-ink-soft hover:bg-card hover:text-ink"
      >
        + Add widget
      </button>
      {open && (
        <ul
          id={listId}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="mt-1 rounded-sm bg-card p-1 shadow-[2px_3px_0_rgb(61_53_80/0.12)]"
        >
          {WIDGET_DEFINITIONS.map((definition) => (
            <li key={definition.type}>
              <button
                type="button"
                onClick={() => {
                  onAdd(definition.type)
                  setOpen(false)
                }}
                className="block w-full rounded-sm px-3 py-1.5 text-left hover:bg-butter"
              >
                {definition.label}
                <span className="block text-xs text-ink-soft">{definition.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
