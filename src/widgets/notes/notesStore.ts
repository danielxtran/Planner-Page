import { create } from 'zustand'
import { saveNote, type NoteDoc } from '../../storage/notes'

interface NotesState {
  /**
   * Bumped whenever a note's contents are replaced from outside its editor
   * (an undo). Notes widgets key their editor on this number, so the editor
   * remounts and loads the restored text instead of keeping its stale copy.
   */
  versions: Record<string, number>
  /** Saves `doc` as the note's contents and tells any open editor to reload. */
  restore: (noteId: string, doc: NoteDoc) => Promise<void>
}

export const useNotesStore = create<NotesState>()((set, get) => ({
  versions: {},
  restore: async (noteId, doc) => {
    await saveNote(noteId, doc)
    set({ versions: { ...get().versions, [noteId]: (get().versions[noteId] ?? 0) + 1 } })
  },
}))
