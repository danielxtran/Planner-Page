import { create } from 'zustand'

interface EditorVersionsState {
  /**
   * Bumped whenever a document's text is replaced from outside its editor (an
   * undo). Widgets key their editor on this number, so the editor remounts and
   * loads the restored text instead of keeping its stale copy. Keyed by the
   * editor's docKey: a note id, or a journal date.
   */
  versions: Record<string, number>
  bump: (docKey: string) => void
}

export const useNotesStore = create<EditorVersionsState>()((set, get) => ({
  versions: {},
  bump: (docKey) =>
    set({ versions: { ...get().versions, [docKey]: (get().versions[docKey] ?? 0) + 1 } }),
}))
