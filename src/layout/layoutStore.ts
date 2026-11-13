import { create } from 'zustand'
import { useErrorStore } from '../state/errorStore'
import { useUndoStore } from '../state/undoStore'
import {
  createPage,
  DEFAULT_PAGE_THEME,
  deletePage,
  getHomePage,
  listPages,
  renamePage,
  restorePage,
  savePageRows,
  savePageTheme,
  type Page,
  type Row,
  type WidgetInstance,
} from '../storage/pages'
import { createWidget } from '../widgets/registry'
import { addWidget, createRow, insertWidgetAfter, updateWidgetConfig } from './operations'

/** What the page tabs need to know about each page. */
export interface PageTab {
  id: string
  name: string
}

interface LayoutData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Every page, in tab order. */
  pages: PageTab[]
  /** The open page, and its layout and theme. */
  pageId: string | null
  rows: Row[]
  theme: string
}

interface LayoutActions {
  ensureLoaded: () => Promise<void>
  /** Shows `next` immediately, saves it, and records an undo step named `label`. */
  commit: (label: string, next: Row[]) => Promise<void>
  /** Saves one widget's settings (e.g. a to-do widget's filter) as an undoable step. */
  setWidgetConfig: (
    widgetId: string,
    label: string,
    config: Record<string, unknown>,
  ) => Promise<void>
  /** Places a new widget directly below an existing one. */
  addWidgetAfter: (afterId: string, widget: WidgetInstance, label: string) => Promise<void>
  setTheme: (theme: string) => Promise<void>
  openPage: (pageId: string) => Promise<void>
  /** Makes a new, empty page and opens it. Resolves to its id, or null if it failed. */
  addPage: (name: string) => Promise<string | null>
  renamePage: (pageId: string, name: string) => Promise<void>
  removePage: (pageId: string) => Promise<void>
}

/** Exported so tests can reset the store between cases. */
export const initialLayoutState: LayoutData = {
  status: 'idle',
  pages: [],
  pageId: null,
  rows: [],
  theme: DEFAULT_PAGE_THEME,
}

/** A first-time page: one full-width row with a to-do list, matching the hub before the grid existed. */
export function createDefaultRows(): Row[] {
  const row = createRow([12])
  return addWidget([row], row.columns[0].id, createWidget('todo'))
}

/**
 * Which page was open last, so the hub reopens on it. Kept in localStorage: it's
 * a small convenience for this browser, not data worth syncing or undoing.
 */
const LAST_PAGE_KEY = 'planner-hub:last-page'
function rememberPage(pageId: string) {
  try {
    localStorage.setItem(LAST_PAGE_KEY, pageId)
  } catch {
    // Storage blocked (private mode): the hub just opens the first page next time.
  }
}
function rememberedPage(): string | null {
  try {
    return localStorage.getItem(LAST_PAGE_KEY)
  } catch {
    return null
  }
}

const toTab = (page: Page): PageTab => ({ id: page.id, name: page.name })

export const useLayoutStore = create<LayoutData & LayoutActions>()((set, get) => {
  const report = (e: unknown, prefix: string) => useErrorStore.getState().report(e, prefix)

  /** Shows a page (already saved) and refreshes the tab list. */
  async function show(pageId: string | null) {
    const pages = await listPages()
    const page = pages.find((p) => p.id === pageId) ?? pages[0]
    set({ pages: pages.map(toTab), pageId: page.id, rows: page.rows, theme: page.theme })
    rememberPage(page.id)
  }

  /**
   * Undo for a change made on `pageId`. If you've moved to another page since,
   * undo takes you back there first, so you can see what it undid.
   */
  async function showForUndo(pageId: string, changes: Partial<Pick<LayoutData, 'rows' | 'theme'>>) {
    if (get().pageId === pageId) set(changes)
    else await show(pageId)
  }

  return {
    ...initialLayoutState,

    ensureLoaded: async () => {
      if (get().status !== 'idle') return
      set({ status: 'loading' })
      try {
        // Makes the Home page the very first time; after that it's just the first page.
        await getHomePage(createDefaultRows)
        await show(rememberedPage())
        set({ status: 'ready' })
      } catch (e) {
        set({ status: 'error' })
        report(e, "Couldn't load your layout: ")
      }
    },

    commit: async (label, next) => {
      const { pageId, rows: previous } = get()
      if (!pageId || next === previous) return
      // Optimistic: show the new layout right away so a dropped widget doesn't
      // jump back while the save is in flight. Reverted below if the save fails.
      set({ rows: next })
      useErrorStore.getState().clear()
      try {
        await savePageRows(pageId, next)
        useUndoStore.getState().push({
          label,
          // The whole previous layout is the undo: layouts are small, and a
          // snapshot can't drift out of sync the way step-by-step reversal can.
          undo: async () => {
            await savePageRows(pageId, previous)
            await showForUndo(pageId, { rows: previous })
          },
        })
      } catch (e) {
        // Only roll back if nothing newer has been shown since.
        if (get().rows === next) set({ rows: previous })
        report(e, "Couldn't save the layout: ")
      }
    },

    // These read the rows at call time (not a value captured during render), so
    // two quick changes in a row each build on the latest layout.
    setWidgetConfig: (widgetId, label, config) =>
      get().commit(label, updateWidgetConfig(get().rows, widgetId, config)),

    addWidgetAfter: (afterId, widget, label) =>
      get().commit(label, insertWidgetAfter(get().rows, afterId, widget)),

    setTheme: async (theme) => {
      const { pageId, theme: previous } = get()
      if (!pageId || theme === previous) return
      set({ theme })
      useErrorStore.getState().clear()
      try {
        await savePageTheme(pageId, theme)
        useUndoStore.getState().push({
          label: 'change theme',
          undo: async () => {
            await savePageTheme(pageId, previous)
            await showForUndo(pageId, { theme: previous })
          },
        })
      } catch (e) {
        if (get().theme === theme) set({ theme: previous })
        report(e, "Couldn't change the theme: ")
      }
    },

    // Switching pages is navigation, not an edit, so it isn't an undo step.
    openPage: async (pageId) => {
      if (pageId === get().pageId) return
      try {
        await show(pageId)
      } catch (e) {
        report(e, "Couldn't open that page: ")
      }
    },

    addPage: async (name) => {
      useErrorStore.getState().clear()
      try {
        // One empty full-width row, ready for widgets.
        const page = await createPage(name, [createRow([12])])
        await show(page.id)
        useUndoStore.getState().push({
          label: `add page "${page.name}"`,
          undo: async () => {
            await deletePage(page.id)
            await show(get().pageId === page.id ? null : get().pageId)
          },
        })
        return page.id
      } catch (e) {
        report(e, "Couldn't add the page: ")
        return null
      }
    },

    renamePage: async (pageId, name) => {
      const before = get().pages.find((p) => p.id === pageId)
      if (!before || name.trim() === before.name) return
      useErrorStore.getState().clear()
      try {
        await renamePage(pageId, name)
        set({ pages: (await listPages()).map(toTab) })
        useUndoStore.getState().push({
          label: `rename page "${before.name}"`,
          undo: async () => {
            await renamePage(pageId, before.name)
            set({ pages: (await listPages()).map(toTab) })
          },
        })
      } catch (e) {
        report(e, "Couldn't rename the page: ")
      }
    },

    removePage: async (pageId) => {
      useErrorStore.getState().clear()
      try {
        const removed = await deletePage(pageId)
        // If it was the open page, move to the first one left.
        await show(get().pageId === pageId ? null : get().pageId)
        useUndoStore.getState().push({
          label: `delete page "${removed.name}"`,
          undo: async () => {
            await restorePage(removed)
            await show(removed.id)
          },
        })
      } catch (e) {
        report(e, "Couldn't delete the page: ")
      }
    },
  }
})
