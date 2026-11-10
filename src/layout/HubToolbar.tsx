import { useErrorStore } from '../state/errorStore'
import { ThemePicker } from './ThemePicker'
import { UndoControls } from './UndoControls'

interface HubToolbarProps {
  editing: boolean
  onToggleEditing: () => void
}

/** Sticky bar above the grid: edit-mode toggle, Undo, theme, and any error message. */
export function HubToolbar({ editing, onToggleEditing }: HubToolbarProps) {
  const error = useErrorStore((s) => s.message)
  const clearError = useErrorStore((s) => s.clear)

  return (
    <div className="sticky top-0 z-30 -mx-2 mb-6 space-y-2 bg-paper/90 px-2 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleEditing}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            editing
              ? 'border-ink/60 bg-mint hover:bg-mint/70'
              : 'border-ink/25 bg-card hover:bg-butter'
          }`}
        >
          {editing ? 'Done editing' : 'Edit layout'}
        </button>
        <UndoControls />
        <div className="ml-auto">
          <ThemePicker />
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-sm bg-rose px-3 py-2 text-sm"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-card"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
