import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { WidgetInstance } from '../storage/pages'
import { getWidgetDefinition } from '../widgets/registry'
import { DragHandle } from './DragHandle'
import type { DragData } from './editorTypes'

interface WidgetFrameProps {
  widget: WidgetInstance
  editing: boolean
  onRemove: () => void
}

/** Renders one placed widget; in edit mode adds a strip with a drag handle and remove button. */
export function WidgetFrame({ widget, editing, onRemove }: WidgetFrameProps) {
  const definition = getWidgetDefinition(widget.type)
  const name = definition?.label ?? 'Unknown widget'
  const data: DragData = { type: 'widget', label: `${name} widget` }
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, data, disabled: !editing })
  const Component = definition?.Component

  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: widgets differ in height, and a scale would squash them.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The original stays behind as a faded placeholder; the drag overlay follows the pointer.
      className={isDragging ? 'opacity-40' : undefined}
    >
      {editing && (
        <div className="mb-1 flex items-center gap-1 rounded-sm bg-butter/70 px-1 text-sm">
          <DragHandle
            ref={setActivatorNodeRef}
            label={`Move ${name} widget`}
            {...attributes}
            {...listeners}
          />
          <span className="flex-1 truncate">{name}</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name} widget`}
            className="grid size-7 place-items-center rounded-full text-lg leading-none text-ink-soft hover:bg-rose hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
      {Component ? (
        <Component widget={widget} />
      ) : (
        // A layout saved by a newer version (or a removed widget type) still renders.
        <p className="rounded-sm border border-dashed border-ink/30 bg-card p-4 text-sm text-ink-soft">
          This widget ("{widget.type}") isn't available in this version.
        </p>
      )}
    </div>
  )
}
