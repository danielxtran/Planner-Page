import { create } from 'zustand'
import { useErrorStore } from './errorStore'

export interface UndoEntry {
  /** Short description of the action, shown next to the Undo button ("delete \"Milk\""). */
  label: string
  /** Reverses the action, including saving the reversal. */
  undo: () => Promise<unknown>
}

interface UndoState {
  entries: UndoEntry[]
  busy: boolean
  push: (entry: UndoEntry) => void
  undo: () => Promise<void>
}

const MAX_UNDO = 50

/**
 * The one undo stack for the whole hub. Tasks, categories, and layout edits all
 * push here, so Ctrl+Z always reverses the most recent action, whichever
 * widget it happened in. (Zustand stores are plain modules: any code can call
 * useUndoStore.getState().push(...), not just React components.)
 */
export const useUndoStore = create<UndoState>()((set, get) => ({
  entries: [],
  busy: false,

  push: (entry) => set({ entries: [...get().entries, entry].slice(-MAX_UNDO) }),

  undo: async () => {
    const { entries, busy } = get()
    const entry = entries.at(-1)
    // `busy` stops a fast double Ctrl+Z from running the same entry twice.
    if (!entry || busy) return
    set({ busy: true, entries: entries.slice(0, -1) })
    useErrorStore.getState().clear()
    try {
      await entry.undo()
    } catch (e) {
      useErrorStore.getState().report(e, "Couldn't undo: ")
    } finally {
      set({ busy: false })
    }
  },
}))
