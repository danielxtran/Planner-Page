import type { Column, Row, WidgetInstance } from '../storage/pages'

/**
 * Pure layout edits: each takes the current rows and returns new rows, never
 * changing its input. Keeping them pure makes them easy to test, and makes
 * undo trivial: the previous layout is just the old value.
 */

/** Narrowest a column can be resized to. One twelfth is too thin for any widget. */
export const MIN_COLUMN_WIDTH = 2

/** Column layouts offered per row. Every entry adds up to 12. */
export const ROW_PRESETS: readonly (readonly number[])[] = [
  [12],
  [6, 6],
  [8, 4],
  [4, 8],
  [4, 4, 4],
  [3, 3, 3, 3],
]

export function createRow(widths: readonly number[] = [12]): Row {
  return {
    id: crypto.randomUUID(),
    columns: widths.map((width) => ({ id: crypto.randomUUID(), width, widgets: [] })),
  }
}

export function addRow(rows: Row[], widths: readonly number[] = [12]): Row[] {
  return [...rows, createRow(widths)]
}

export function removeRow(rows: Row[], rowId: string): Row[] {
  return rows.filter((row) => row.id !== rowId)
}

export function moveRow(rows: Row[], fromIndex: number, toIndex: number): Row[] {
  const next = [...rows]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/**
 * Gives a row a new set of column widths. Existing columns keep their widgets
 * in order; if the new layout has fewer columns, widgets from the dropped
 * columns move into the last remaining one, so changing layout never deletes anything.
 */
export function applyPreset(rows: Row[], rowId: string, widths: readonly number[]): Row[] {
  return mapRow(rows, rowId, (row) => {
    const columns: Column[] = widths.map((width, i) => {
      const existing = row.columns[i]
      return existing ? { ...existing, width } : { id: crypto.randomUUID(), width, widgets: [] }
    })
    const leftovers = row.columns.slice(widths.length).flatMap((c) => c.widgets)
    if (leftovers.length > 0) {
      const last = columns[columns.length - 1]
      columns[columns.length - 1] = { ...last, widgets: [...last.widgets, ...leftovers] }
    }
    return { ...row, columns }
  })
}

/**
 * Moves the border between column `leftIndex` and the one after it by `delta`
 * twelfths (positive = rightwards). Clamped so neither side drops below
 * MIN_COLUMN_WIDTH; the row's total always stays 12.
 */
export function resizeColumns(rows: Row[], rowId: string, leftIndex: number, delta: number): Row[] {
  return mapRow(rows, rowId, (row) => {
    const left = row.columns[leftIndex]
    const right = row.columns[leftIndex + 1]
    if (!left || !right) return row
    const clamped = clampResize(left.width, right.width, delta)
    if (clamped === 0) return row
    const columns = [...row.columns]
    columns[leftIndex] = { ...left, width: left.width + clamped }
    columns[leftIndex + 1] = { ...right, width: right.width - clamped }
    return { ...row, columns }
  })
}

/** The part of `delta` that keeps both columns at least MIN_COLUMN_WIDTH wide. */
export function clampResize(leftWidth: number, rightWidth: number, delta: number): number {
  return Math.max(MIN_COLUMN_WIDTH - leftWidth, Math.min(rightWidth - MIN_COLUMN_WIDTH, delta))
}

/** Appends a widget to the bottom of a column. */
export function addWidget(rows: Row[], columnId: string, widget: WidgetInstance): Row[] {
  return mapColumn(rows, columnId, (column) => ({
    ...column,
    widgets: [...column.widgets, widget],
  }))
}

export function removeWidget(rows: Row[], widgetId: string): Row[] {
  return rows.map((row) => ({
    ...row,
    columns: row.columns.map((column) => ({
      ...column,
      widgets: column.widgets.filter((w) => w.id !== widgetId),
    })),
  }))
}

/**
 * Moves a widget to `toIndex` in a column (the same one or another). The index
 * is counted after the widget has been taken out, like moving an item in a list.
 */
export function moveWidget(
  rows: Row[],
  widgetId: string,
  toColumnId: string,
  toIndex: number,
): Row[] {
  const found = findWidget(rows, widgetId)
  if (!found || !findColumn(rows, toColumnId)) return rows
  const without = removeWidget(rows, widgetId)
  return mapColumn(without, toColumnId, (column) => {
    const widgets = [...column.widgets]
    widgets.splice(Math.max(0, Math.min(toIndex, widgets.length)), 0, found.widget)
    return { ...column, widgets }
  })
}

export interface WidgetLocation {
  widget: WidgetInstance
  column: Column
  row: Row
  /** Position within its column. */
  index: number
}

export function findWidget(rows: Row[], widgetId: string): WidgetLocation | null {
  for (const row of rows) {
    for (const column of row.columns) {
      const index = column.widgets.findIndex((w) => w.id === widgetId)
      if (index >= 0) return { widget: column.widgets[index], column, row, index }
    }
  }
  return null
}

export function findColumn(rows: Row[], columnId: string): Column | null {
  for (const row of rows) {
    const column = row.columns.find((c) => c.id === columnId)
    if (column) return column
  }
  return null
}

/** Which preset a row currently matches, if any (rows can be resized off-preset). */
export function matchesPreset(row: Row, widths: readonly number[]): boolean {
  return row.columns.length === widths.length && row.columns.every((c, i) => c.width === widths[i])
}

// Both helpers hand back the original array when nothing changed, so callers
// can cheaply tell a no-op apart (and skip saving it or adding an undo step).
function mapRow(rows: Row[], rowId: string, change: (row: Row) => Row): Row[] {
  let changed = false
  const next = rows.map((row) => {
    if (row.id !== rowId) return row
    const updated = change(row)
    if (updated !== row) changed = true
    return updated
  })
  return changed ? next : rows
}

function mapColumn(rows: Row[], columnId: string, change: (column: Column) => Column): Row[] {
  const row = rows.find((r) => r.columns.some((c) => c.id === columnId))
  if (!row) return rows
  return mapRow(rows, row.id, (r) => ({
    ...r,
    columns: r.columns.map((c) => (c.id === columnId ? change(c) : c)),
  }))
}
