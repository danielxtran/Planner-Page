import { create } from 'zustand'
import { useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
import {
  listJournalEntries,
  saveJournalEntry,
  type JournalEntry,
  type Mood,
} from '../../storage/journal'
import type { NoteDoc } from '../../storage/notes'
import { promptFor } from './journalData'

interface JournalState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Every entry by date ('yyyy-MM-dd'). Shared by all journal widgets: there's one journal. */
  entries: Record<string, JournalEntry>
  ensureLoaded: () => Promise<void>
  /** Saves the day's writing. The editor makes its own undo steps, one per editing stretch. */
  saveDoc: (date: string, doc: NoteDoc, prompt: string) => Promise<void>
  /** Picks (or with null, clears) the day's mood, as an undo step. */
  setMood: (date: string, mood: Mood | null, prompt: string) => Promise<void>
  /** Swaps the day's prompt, as an undo step. */
  setPrompt: (date: string, prompt: string) => Promise<void>
}

export const initialJournalState = {
  status: 'idle' as const,
  entries: {} as Record<string, JournalEntry>,
}

export const useJournalStore = create<JournalState>()((set, get) => {
  const report = (e: unknown, prefix: string) => useErrorStore.getState().report(e, prefix)
  const keep = (entry: JournalEntry) => set({ entries: { ...get().entries, [entry.date]: entry } })

  return {
    ...initialJournalState,

    ensureLoaded: async () => {
      if (get().status !== 'idle') return
      set({ status: 'loading' })
      try {
        const entries = await listJournalEntries()
        set({ status: 'ready', entries: Object.fromEntries(entries.map((e) => [e.date, e])) })
      } catch (e) {
        set({ status: 'error' })
        report(e, "Couldn't load your journal: ")
      }
    },

    saveDoc: async (date, doc, prompt) => {
      keep(await saveJournalEntry(date, { doc }, prompt))
    },

    setMood: async (date, mood, prompt) => {
      const before = get().entries[date]?.mood ?? null
      if (before === mood) return
      useErrorStore.getState().clear()
      try {
        keep(await saveJournalEntry(date, { mood }, prompt))
        useUndoStore.getState().push({
          label: mood ? 'pick mood' : 'clear mood',
          undo: async () => keep(await saveJournalEntry(date, { mood: before }, prompt)),
        })
      } catch (e) {
        report(e, "Couldn't save your mood: ")
      }
    },

    setPrompt: async (date, prompt) => {
      // With no entry yet, the prompt being replaced was the day's automatic one.
      const before = get().entries[date]?.prompt ?? promptFor(date)
      if (before === prompt) return
      useErrorStore.getState().clear()
      try {
        keep(await saveJournalEntry(date, { prompt }, prompt))
        useUndoStore.getState().push({
          label: 'change prompt',
          undo: async () => keep(await saveJournalEntry(date, { prompt: before }, before)),
        })
      } catch (e) {
        report(e, "Couldn't change the prompt: ")
      }
    },
  }
})
