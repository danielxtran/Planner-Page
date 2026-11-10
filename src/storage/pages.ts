import { db } from './db'
import { LOCAL_USER_ID } from './user'

/** Columns per row. Column widths are whole twelfths and each row's widths add up to this. */
export const GRID_COLUMNS = 12

/**
 * One placed widget. `type` picks the component from the widget registry;
 * `config` is that widget's own settings (e.g. a saved filter), kept as plain JSON.
 * Storage doesn't know which types exist, so an unknown type is stored as-is.
 */
export interface WidgetInstance {
  id: string
  type: string
  config: Record<string, unknown>
}

export interface Column {
  id: string
  /** In twelfths of the row, 1-12. */
  width: number
  /** Stacked top to bottom. */
  widgets: WidgetInstance[]
}

export interface Row {
  id: string
  columns: Column[]
}

/** A hub page. The whole layout lives inside one record, so one save = one consistent layout. */
export interface Page {
  id: string
  userId: string
  name: string
  rows: Row[]
  createdAt: string
  updatedAt: string
}

/**
 * The user's first page, created from `defaultRows()` if they have none yet.
 * The caller supplies the defaults so storage stays unaware of widget types.
 */
export async function getHomePage(defaultRows: () => Row[]): Promise<Page> {
  // The transaction makes "look, then create" atomic: two calls at once (React
  // StrictMode mounts twice in development) still create only one page.
  return db.transaction('rw', db.pages, async () => {
    const [existing] = await db.pages.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt')
    if (existing) return existing

    const rows = defaultRows()
    assertValidRows(rows)
    const now = new Date().toISOString()
    const page: Page = {
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      name: 'Home',
      rows,
      createdAt: now,
      updatedAt: now,
    }
    await db.pages.add(page)
    return page
  })
}

/** Replaces a page's layout. Rejects a malformed layout without saving anything. */
export async function savePageRows(pageId: string, rows: Row[]): Promise<Page> {
  assertValidRows(rows)
  return db.transaction('rw', db.pages, async () => {
    const page = await db.pages.get(pageId)
    if (!page || page.userId !== LOCAL_USER_ID) throw new Error(`Page not found: ${pageId}`)
    const updated: Page = { ...page, rows, updatedAt: new Date().toISOString() }
    await db.pages.put(updated)
    return updated
  })
}

/**
 * Structural checks on a layout. The editor should never produce a bad one;
 * this is the last line of defense so a bug can't save a layout that won't render.
 */
export function assertValidRows(rows: Row[]) {
  const ids = new Set<string>()
  const claim = (id: unknown, what: string) => {
    if (typeof id !== 'string' || !id) throw new Error(`Layout ${what} is missing an id`)
    if (ids.has(id)) throw new Error(`Layout id used twice: ${id}`)
    ids.add(id)
  }

  for (const row of rows) {
    claim(row.id, 'row')
    if (!Array.isArray(row.columns) || row.columns.length === 0) {
      throw new Error(`Row ${row.id} has no columns`)
    }
    let total = 0
    for (const column of row.columns) {
      claim(column.id, 'column')
      if (!Number.isInteger(column.width) || column.width < 1 || column.width > GRID_COLUMNS) {
        throw new Error(
          `Column ${column.id} width must be a whole number 1-12, got ${column.width}`,
        )
      }
      total += column.width
      for (const widget of column.widgets) {
        claim(widget.id, 'widget')
        if (typeof widget.type !== 'string' || !widget.type) {
          throw new Error(`Widget ${widget.id} has no type`)
        }
        if (typeof widget.config !== 'object' || widget.config === null) {
          throw new Error(`Widget ${widget.id} config must be an object`)
        }
      }
    }
    if (total !== GRID_COLUMNS) {
      throw new Error(`Row ${row.id} column widths add up to ${total}, not ${GRID_COLUMNS}`)
    }
  }
}
