/** What each draggable/droppable carries, so drag handlers know what they're dealing with. */
export interface DragData {
  type: 'row' | 'column' | 'widget'
  /** Spoken in screen-reader announcements and shown on the drag preview, e.g. "To-do list widget". */
  label: string
}

/** Edits the grid's rows and columns can ask for. LayoutGrid applies them to the saved layout. */
export interface EditorActions {
  applyPreset: (rowId: string, widths: readonly number[]) => void
  removeRow: (rowId: string) => void
  addWidget: (columnId: string, type: string) => void
  removeWidget: (widgetId: string) => void
  /** `delta` in twelfths from the drag start; null means the drag ended or was cancelled. */
  previewResize: (rowId: string, leftIndex: number, delta: number | null) => void
  commitResize: (rowId: string, leftIndex: number, delta: number) => void
}
