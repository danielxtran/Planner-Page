import { create } from 'zustand'
import { useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
import type { CategoryColor } from '../../storage/categories'
import {
  deleteStickyNote,
  getStickyBoard,
  listStickyNotes,
  restoreStickyNote,
  saveStickyBoard,
  stickDraftAside,
  unstickNote,
  type StickyNote,
} from '../../storage/stickies'

export interface BoardState {
  status: 'loading' | 'ready' | 'error'
  draft: string
  color: CategoryColor
  notes: StickyNote[]
  /**
   * Bumped when the pad's text is replaced from outside it (an undo, or
   * sticking a note aside), so the pad drops whatever it was showing and
   * shows the stored text. Your own typing doesn't bump it.
   */
  version: number
}

interface StickyState {
  boards: Record<string, BoardState>
  load: (boardId: string) => Promise<void>
  /** Saves typing on the pad. Not an undo step by itself; the widget makes one per editing stretch. */
  saveDraft: (boardId: string, draft: string) => Promise<void>
  /** Puts back older pad text (used by undo). */
  restoreDraft: (boardId: string, draft: string) => Promise<void>
  setColor: (boardId: string, color: CategoryColor) => Promise<void>
  /** Moves `text` from the pad onto a new note in the pile. */
  stickAside: (boardId: string, text: string) => Promise<boolean>
  remove: (boardId: string, noteId: string) => Promise<void>
}

export const useStickyStore = create<StickyState>()((set, get) => {
  const report = (e: unknown, prefix: string) => useErrorStore.getState().report(e, prefix)
  const patch = (boardId: string, changes: Partial<BoardState>) => {
    const board = get().boards[boardId]
    if (board) set({ boards: { ...get().boards, [boardId]: { ...board, ...changes } } })
  }
  const bump = (boardId: string) => (get().boards[boardId]?.version ?? 0) + 1

  async function reload(boardId: string, changes: Partial<BoardState> = {}) {
    const [board, notes] = await Promise.all([getStickyBoard(boardId), listStickyNotes(boardId)])
    patch(boardId, { draft: board.draft, color: board.color, notes, ...changes })
  }

  return {
    boards: {},

    load: async (boardId) => {
      if (get().boards[boardId]) return
      set({
        boards: {
          ...get().boards,
          [boardId]: { status: 'loading', draft: '', color: 'butter', notes: [], version: 0 },
        },
      })
      try {
        await reload(boardId, { status: 'ready' })
      } catch (e) {
        patch(boardId, { status: 'error' })
        report(e, "Couldn't load your sticky notes: ")
      }
    },

    saveDraft: async (boardId, draft) => {
      try {
        await saveStickyBoard(boardId, { draft })
        patch(boardId, { draft })
      } catch (e) {
        report(e, "Couldn't save your sticky note: ")
      }
    },

    restoreDraft: async (boardId, draft) => {
      await saveStickyBoard(boardId, { draft })
      patch(boardId, { draft, version: bump(boardId) })
    },

    setColor: async (boardId, color) => {
      const before = get().boards[boardId]?.color
      if (!before || before === color) return
      useErrorStore.getState().clear()
      try {
        await saveStickyBoard(boardId, { color })
        patch(boardId, { color })
        useUndoStore.getState().push({
          label: 'change sticky note color',
          undo: async () => {
            await saveStickyBoard(boardId, { color: before })
            patch(boardId, { color: before })
          },
        })
      } catch (e) {
        report(e, "Couldn't change the color: ")
      }
    },

    stickAside: async (boardId, text) => {
      if (!text.trim()) return false
      useErrorStore.getState().clear()
      try {
        await saveStickyBoard(boardId, { draft: text })
        const { note } = await stickDraftAside(boardId)
        await reload(boardId, { version: bump(boardId) })
        useUndoStore.getState().push({
          label: 'stick note aside',
          // Takes the note back off the pile and puts the text back on the pad.
          undo: async () => {
            await unstickNote(note, text)
            await reload(boardId, { version: bump(boardId) })
          },
        })
        return true
      } catch (e) {
        report(e, "Couldn't stick the note aside: ")
        return false
      }
    },

    remove: async (boardId, noteId) => {
      useErrorStore.getState().clear()
      try {
        const note = await deleteStickyNote(noteId)
        await reload(boardId)
        useUndoStore.getState().push({
          label: 'delete sticky note',
          undo: async () => {
            await restoreStickyNote(note)
            await reload(boardId)
          },
        })
      } catch (e) {
        report(e, "Couldn't delete the sticky note: ")
      }
    },
  }
})
