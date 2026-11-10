import { useEffect } from 'react'
import { isEditable, isUndoShortcut } from '../state/keyboard'
import { useUndoStore } from '../state/undoStore'

/**
 * The hub-wide Undo button, plus Ctrl/Cmd+Z anywhere on the page. Ctrl+Z
 * inside a text field is left alone so it keeps doing normal text undo.
 */
export function UndoControls() {
  // Selecting just the label means this only re-renders when the label changes.
  const label = useUndoStore((s) => s.entries.at(-1)?.label ?? null)
  const undo = useUndoStore((s) => s.undo)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isUndoShortcut(e) && !isEditable(e.target)) {
        e.preventDefault()
        void undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  if (!label) return null

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
      <button
        type="button"
        onClick={() => void undo()}
        className="shrink-0 rounded-full bg-sky px-3 py-1 text-ink hover:bg-sky/70"
      >
        Undo <kbd className="font-sans text-xs text-ink-soft">Ctrl+Z</kbd>
      </button>
      <span className="truncate">Last: {label}</span>
    </div>
  )
}
