import { useEffect, useState } from 'react'
import { HubToolbar } from './HubToolbar'
import { LayoutGrid } from './LayoutGrid'
import { useLayoutStore } from './layoutStore'
import { addRow } from './operations'

/** The hub page: toolbar plus the widget grid, with an edit mode for rearranging it. */
export function Hub() {
  const status = useLayoutStore((s) => s.status)
  const rows = useLayoutStore((s) => s.rows)
  const commit = useLayoutStore((s) => s.commit)
  const ensureLoaded = useLayoutStore((s) => s.ensureLoaded)
  // Normal use stays free of handles and outlines, so nothing gets dragged by accident.
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  return (
    <>
      <HubToolbar editing={editing} onToggleEditing={() => setEditing((e) => !e)} />

      {(status === 'idle' || status === 'loading') && <p className="text-ink-soft">Loading…</p>}

      {status === 'ready' &&
        (rows.length === 0 && !editing ? (
          <p className="font-hand text-2xl text-ink-soft">
            Your hub is empty. Click "Edit layout" to add a row and some widgets.
          </p>
        ) : (
          <LayoutGrid
            rows={rows}
            editing={editing}
            onCommit={(label, next) => void commit(label, next)}
          />
        ))}

      {status === 'ready' && editing && (
        <button
          type="button"
          onClick={() => void commit('add row', addRow(rows))}
          className="mt-6 w-full rounded-sm border-2 border-dashed border-ink/30 py-3 font-hand text-2xl text-ink-soft hover:bg-card hover:text-ink"
        >
          + Add row
        </button>
      )}
    </>
  )
}
