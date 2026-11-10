import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import type { Row } from '../storage/pages'
import { createWidget, getWidgetDefinition } from '../widgets/registry'
import type { DragData, EditorActions } from './editorTypes'
import {
  addWidget,
  applyPreset,
  findColumn,
  findWidget,
  moveRow,
  moveWidget,
  removeRow,
  removeWidget,
  resizeColumns,
} from './operations'
import { RowView } from './RowView'

interface LayoutGridProps {
  rows: Row[]
  editing: boolean
  onCommit: (label: string, next: Row[]) => void
}

/**
 * Renders the page's rows and runs drag-and-drop. During a drag or resize the
 * grid shows a local `preview`; the saved layout only changes when you let go,
 * so each drag is one save and one undo step.
 */
export function LayoutGrid({ rows, editing, onCommit }: LayoutGridProps) {
  const [preview, setPreview] = useState<Row[] | null>(null)
  const [dragging, setDragging] = useState<DragData | null>(null)
  const shown = preview ?? rows

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a plain click on a handle isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const actions: EditorActions = {
    applyPreset: (rowId, widths) => onCommit('change row layout', applyPreset(rows, rowId, widths)),
    removeRow: (rowId) => onCommit('remove row', removeRow(rows, rowId)),
    addWidget: (columnId, type) =>
      onCommit(`add ${widgetName(type)}`, addWidget(rows, columnId, createWidget(type))),
    removeWidget: (widgetId) =>
      onCommit(
        `remove ${widgetName(findWidget(rows, widgetId)?.widget.type)}`,
        removeWidget(rows, widgetId),
      ),
    previewResize: (rowId, leftIndex, delta) =>
      setPreview(delta === null ? null : resizeColumns(rows, rowId, leftIndex, delta)),
    commitResize: (rowId, leftIndex, delta) => {
      setPreview(null)
      onCommit('resize columns', resizeColumns(rows, rowId, leftIndex, delta))
    },
  }

  function handleDragStart({ active }: DragStartEvent) {
    setDragging(dataOf(active) ?? null)
  }

  // Moving between columns happens live while dragging, so the target column
  // opens a gap and the drop lands where you see it.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || dataOf(active)?.type !== 'widget') return
    setPreview((current) => {
      const base = current ?? rows
      const from = findWidget(base, String(active.id))
      const to = targetColumn(base, over)
      // Reordering within one column is animated by dnd-kit itself and applied on drop.
      if (!from || !to || from.column.id === to.id) return base
      const overIndex = to.widgets.findIndex((w) => w.id === over.id)
      return moveWidget(base, from.widget.id, to.id, overIndex >= 0 ? overIndex : to.widgets.length)
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const data = dataOf(active)
    const base = preview ?? rows
    setPreview(null)
    setDragging(null)
    // Dropped outside any target: treat it like a cancel.
    if (!over || !data) return

    if (data.type === 'row') {
      const from = base.findIndex((r) => r.id === active.id)
      const to = base.findIndex((r) => r.id === over.id)
      if (from >= 0 && to >= 0 && from !== to) onCommit('move row', moveRow(base, from, to))
      return
    }

    let next = base
    const from = findWidget(base, String(active.id))
    const to = targetColumn(base, over)
    if (from && to && from.column.id === to.id && dataOf(over)?.type === 'widget') {
      const overIndex = to.widgets.findIndex((w) => w.id === over.id)
      if (overIndex >= 0 && overIndex !== from.index) {
        next = moveWidget(base, from.widget.id, to.id, overIndex)
      }
    }
    // Picking a widget up and putting it back where it was isn't worth an undo step.
    if (JSON.stringify(next) !== JSON.stringify(rows)) onCommit(`move ${data.label}`, next)
  }

  function handleDragCancel() {
    setPreview(null)
    setDragging(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext items={shown.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {shown.map((row, index) => (
            <RowView key={row.id} row={row} index={index} editing={editing} actions={actions} />
          ))}
        </div>
      </SortableContext>
      {/* What follows the pointer: a small label card, not a full copy of the widget. */}
      <DragOverlay>
        {dragging && (
          <div className="w-fit rotate-1 rounded-sm border-2 border-ink/40 bg-card px-4 py-2 font-hand text-2xl shadow-[3px_4px_0_rgb(61_53_80/0.18)]">
            {capitalize(dragging.label)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Rows only collide with rows, widgets only with widgets and columns. Without
 * this, dragging a widget over a row would treat the whole row as the target.
 */
const collisionDetection: CollisionDetection = (args) => {
  const draggingRow = dataOf(args.active)?.type === 'row'
  const droppableContainers = args.droppableContainers.filter(
    (c) => (dataOf(c)?.type === 'row') === draggingRow,
  )
  const scoped = { ...args, droppableContainers }
  if (draggingRow) return closestCenter(scoped)

  // Prefer what's under the pointer, and a widget over the column it sits in.
  // Keyboard drags have no pointer, so they fall back to the nearest corners.
  const underPointer = pointerWithin(scoped)
  if (underPointer.length > 0) {
    const widgetIds = new Set(
      droppableContainers.filter((c) => dataOf(c)?.type === 'widget').map((c) => c.id),
    )
    const widgetHit = underPointer.find((c) => widgetIds.has(c.id))
    return widgetHit ? [widgetHit] : underPointer
  }
  return closestCorners(scoped)
}

/** The column a drag is over: the column itself, or the one holding the widget it's over. */
function targetColumn(rows: Row[], over: Over) {
  const type = dataOf(over)?.type
  if (type === 'column') return findColumn(rows, String(over.id))
  if (type === 'widget') return findWidget(rows, String(over.id))?.column ?? null
  return null
}

function dataOf(item: { data: { current?: unknown } }): DragData | undefined {
  return item.data.current as DragData | undefined
}

function widgetName(type: string | undefined) {
  return type ? (getWidgetDefinition(type)?.label ?? 'widget') : 'widget'
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// dnd-kit's defaults announce raw ids ("Picked up draggable item 3f2a…"); these use names.
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${dataOf(active)?.label}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `${capitalize(dataOf(active)?.label ?? '')} is over ${dataOf(over)?.label}.`
      : `${capitalize(dataOf(active)?.label ?? '')} is not over a drop spot.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `Dropped ${dataOf(active)?.label} on ${dataOf(over)?.label}.`
      : `Dropped ${dataOf(active)?.label}. Nothing moved.`,
  onDragCancel: ({ active }) => `Cancelled. ${capitalize(dataOf(active)?.label ?? '')} went back.`,
}

const screenReaderInstructions = {
  draggable:
    'To pick up, press Space or Enter. Use the arrow keys to move, Space or Enter to drop, or Escape to cancel.',
}
