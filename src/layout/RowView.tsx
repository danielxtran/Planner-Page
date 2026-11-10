import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRef } from 'react'
import type { Row } from '../storage/pages'
import { ColumnView } from './ColumnView'
import { DragHandle } from './DragHandle'
import type { DragData, EditorActions } from './editorTypes'
import { matchesPreset, ROW_PRESETS } from './operations'

interface RowViewProps {
  row: Row
  index: number
  editing: boolean
  actions: EditorActions
}

export function RowView({ row, index, editing, actions }: RowViewProps) {
  const name = `Row ${index + 1}`
  const data: DragData = { type: 'row', label: name.toLowerCase() }
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, data, disabled: !editing })
  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      role={editing ? 'group' : undefined}
      aria-label={editing ? name : undefined}
      className={
        editing
          ? `rounded-sm border-2 border-dashed border-ink/25 bg-paper/70 p-3 ${isDragging ? 'opacity-40' : ''}`
          : undefined
      }
    >
      {editing && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <DragHandle
            ref={setActivatorNodeRef}
            label={`Move ${name.toLowerCase()}`}
            {...attributes}
            {...listeners}
          />
          <span className="font-hand text-xl">{name}</span>
          <div
            role="group"
            aria-label={`Columns in ${name.toLowerCase()}`}
            className="flex flex-wrap gap-1"
          >
            {ROW_PRESETS.map((widths) => {
              const current = matchesPreset(row, widths)
              return (
                <button
                  key={widths.join('-')}
                  type="button"
                  aria-pressed={current}
                  aria-label={presetLabel(widths)}
                  title={presetLabel(widths)}
                  onClick={() => !current && actions.applyPreset(row.id, widths)}
                  className={`rounded-sm border px-1.5 py-1 ${current ? 'border-ink/60 bg-lavender' : 'border-ink/20 hover:bg-card'}`}
                >
                  <PresetIcon widths={widths} />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => actions.removeRow(row.id)}
            aria-label={`Remove ${name.toLowerCase()}`}
            className="ml-auto rounded-full px-3 py-1 text-ink-soft hover:bg-rose hover:text-ink"
          >
            Remove row
          </button>
        </div>
      )}
      <div ref={gridRef} className="grid grid-cols-12 gap-4">
        {row.columns.map((column, columnIndex) => (
          <ColumnView
            key={column.id}
            column={column}
            next={row.columns[columnIndex + 1]}
            rowId={row.id}
            rowIndex={index}
            columnIndex={columnIndex}
            editing={editing}
            actions={actions}
            gridRef={gridRef}
          />
        ))}
      </div>
    </div>
  )
}

/** A tiny picture of a column layout, e.g. a wide block and a narrow one for 8 + 4. */
function PresetIcon({ widths }: { widths: readonly number[] }) {
  return (
    <span aria-hidden className="grid h-3.5 w-10 grid-cols-12 gap-0.5">
      {widths.map((width, i) => (
        <span
          key={i}
          style={{ gridColumn: `span ${width} / span ${width}` }}
          className="rounded-[2px] bg-ink/45"
        />
      ))}
    </span>
  )
}

function presetLabel(widths: readonly number[]) {
  return widths.length === 1
    ? 'One full-width column'
    : `${widths.length} columns, ${widths.join(' + ')} twelfths`
}
