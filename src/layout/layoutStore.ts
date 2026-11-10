import { create } from 'zustand'
import { useErrorStore } from '../state/errorStore'
import { useUndoStore } from '../state/undoStore'
import { getHomePage, savePageRows, type Row } from '../storage/pages'
import { createWidget } from '../widgets/registry'
import { addWidget, createRow } from './operations'

interface LayoutData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  pageId: string | null
  rows: Row[]
}

interface LayoutActions {
  ensureLoaded: () => Promise<void>
  /** Shows `next` immediately, saves it, and records an undo step named `label`. */
  commit: (label: string, next: Row[]) => Promise<void>
}

/** Exported so tests can reset the store between cases. */
export const initialLayoutState: LayoutData = { status: 'idle', pageId: null, rows: [] }

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
      set({ status: 'ready', pageId: page.id, rows: page.rows })
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
      set({ rows: previous })
      useErrorStore.getState().report(e, "Couldn't save the layout: ")
    }
  },
}))
