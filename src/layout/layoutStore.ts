import { create } from 'zustand'
import { useErrorStore } from '../state/errorStore'
import { useUndoStore } from '../state/undoStore'
import {
  DEFAULT_PAGE_THEME,
  getHomePage,
  savePageRows,
  savePageTheme,
  type Row,
  type WidgetInstance,
} from '../storage/pages'
import { createWidget } from '../widgets/registry'
import { addWidget, createRow, insertWidgetAfter, updateWidgetConfig } from './operations'

interface LayoutData {
  status: 'idle' | 'loading' | 'ready' | 'error'
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
}

/** Exported so tests can reset the store between cases. */
export const initialLayoutState: LayoutData = {
  status: 'idle',
  pageId: null,
  rows: [],
  theme: DEFAULT_PAGE_THEME,
}

/** A first-time page: one full-width row with a to-do list, matching the hub before the grid existed. */
export function createDefaultRows(): Row[] {
  const row = createRow([12])
  return addWidget([row], row.columns[0].id, createWidget('todo'))
}

export const useLayoutStore = create<LayoutData & LayoutActions>()((set, get) => ({
  ...initialLayoutState,

  ensureLoaded: async () => {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    try {
      const page = await getHomePage(createDefaultRows)
      set({ status: 'ready', pageId: page.id, rows: page.rows, theme: page.theme })
    } catch (e) {
      set({ status: 'error' })
      useErrorStore.getState().report(e, "Couldn't load your layout: ")
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
          set({ rows: previous })
        },
      })
    } catch (e) {
      // Only roll back if nothing newer has been shown since.
      if (get().rows === next) set({ rows: previous })
      useErrorStore.getState().report(e, "Couldn't save the layout: ")
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
          set({ theme: previous })
        },
      })
    } catch (e) {
      if (get().theme === theme) set({ theme: previous })
      useErrorStore.getState().report(e, "Couldn't change the theme: ")
    }
  },
}))
