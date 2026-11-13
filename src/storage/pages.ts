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

/** Theme for pages created before themes existed, and for brand-new pages. */
export const DEFAULT_PAGE_THEME = 'graph'

/** A hub page. The whole layout lives inside one record, so one save = one consistent layout. */
export interface Page {
  id: string
  userId: string
  name: string
  /** Which look the page uses, e.g. 'graph' or 'bujo'. The list of themes lives in src/theme/. */
  theme: string
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
      theme: DEFAULT_PAGE_THEME,
      rows,
      createdAt: now,
      updatedAt: now,
    }
    await db.pages.add(page)
    return page
  })
}

/** Every page, in the order they were made (the order of the page tabs). */
export async function listPages(): Promise<Page[]> {
  return db.pages.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt')
}

export const MAX_PAGE_NAME_LENGTH = 40

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_PAGE_NAME_LENGTH)
  if (!trimmed) throw new Error('Give the page a name')
  return trimmed
}

/** A new page, last in the tab order. */
export async function createPage(
  name: string,
  rows: Row[],
  theme = DEFAULT_PAGE_THEME,
): Promise<Page> {
  assertValidRows(rows)
  const now = new Date().toISOString()
  const page: Page = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER_ID,
    name: cleanName(name),
    theme,
    rows,
    createdAt: now,
    updatedAt: now,
  }
  await db.pages.add(page)
  return page
}

export async function renamePage(pageId: string, name: string): Promise<Page> {
  return updatePage(pageId, { name: cleanName(name) })
}

/**
 * Deletes a page and hands it back, so undo can restore it exactly. The data
 * its widgets point to (tasks, notes, images) is shared or kept, like removing
 * a widget: deleting a page never deletes your writing.
 */
export async function deletePage(pageId: string): Promise<Page> {
  return db.transaction('rw', db.pages, async () => {
    const page = await db.pages.get(pageId)
    if (!page || page.userId !== LOCAL_USER_ID) throw new Error(`Page not found: ${pageId}`)
    const count = await db.pages.where('userId').equals(LOCAL_USER_ID).count()
    if (count <= 1) throw new Error("You can't delete your only page")
    await db.pages.delete(pageId)
    return page
  })
}

/** Puts a deleted page back (same id, same place in the tab order). */
export async function restorePage(page: Page): Promise<void> {
  await db.pages.put(page)
}

/** Replaces a page's layout. Rejects a malformed layout without saving anything. */
export async function savePageRows(pageId: string, rows: Row[]): Promise<Page> {
  assertValidRows(rows)
  return updatePage(pageId, { rows })
}

/** Switches a page's theme. */
export async function savePageTheme(pageId: string, theme: string): Promise<Page> {
  if (typeof theme !== 'string' || !theme.trim()) throw new Error('Theme name is required')
  return updatePage(pageId, { theme })
}

async function updatePage(pageId: string, changes: Partial<Pick<Page, 'rows' | 'theme' | 'name'>>) {
  return db.transaction('rw', db.pages, async () => {
    const page = await db.pages.get(pageId)
    if (!page || page.userId !== LOCAL_USER_ID) throw new Error(`Page not found: ${pageId}`)
    const updated: Page = { ...page, ...changes, updatedAt: new Date().toISOString() }
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
