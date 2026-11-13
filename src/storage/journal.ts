import { db } from './db'
import type { NoteDoc } from './notes'
import { LOCAL_USER_ID } from './user'

/** The moods a day can have. Ids are stored; labels and colors live in the journal widget. */
export const MOODS = ['great', 'good', 'okay', 'low', 'rough'] as const
export type Mood = (typeof MOODS)[number]

/**
 * One day's journal entry. There's at most one per day: `date` plus `userId`
 * is a unique index, so even two saves racing can't make a second entry.
 */
export interface JournalEntry {
  id: string
  userId: string
  /** 'yyyy-MM-dd', the day the entry is for (in the writer's own time zone). */
  date: string
  doc: NoteDoc
  mood: Mood | null
  /** The prompt shown that day, kept so an old entry still shows what it answered. */
  prompt: string
  createdAt: string
  updatedAt: string
}

export type EntryChanges = Partial<Pick<JournalEntry, 'doc' | 'mood' | 'prompt'>>

const DATE = /^\d{4}-\d{2}-\d{2}$/

function assertDate(date: string) {
  if (!DATE.test(date) || Number.isNaN(Date.parse(date)))
    throw new Error(`Bad journal date: ${date}`)
}

export async function getJournalEntry(date: string): Promise<JournalEntry | undefined> {
  assertDate(date)
  return db.journalEntries.where('[userId+date]').equals([LOCAL_USER_ID, date]).first()
}

/** Every entry, oldest first. A few years of daily entries is still a small amount of data. */
export async function listJournalEntries(): Promise<JournalEntry[]> {
  return db.journalEntries.where('userId').equals(LOCAL_USER_ID).sortBy('date')
}

/**
 * Updates a day's entry, creating it the first time anything is written,
 * picked, or shuffled for that day. `prompt` is the prompt to store if the
 * entry is new and `changes` doesn't name one.
 */
export async function saveJournalEntry(
  date: string,
  changes: EntryChanges,
  prompt: string,
): Promise<JournalEntry> {
  assertDate(date)
  if (changes.mood !== undefined && changes.mood !== null && !MOODS.includes(changes.mood)) {
    throw new Error(`Unknown mood: ${String(changes.mood)}`)
  }
  if (changes.doc !== undefined && changes.doc?.type !== 'doc') {
    throw new Error('Journal text must be a document')
  }
  return db.transaction('rw', db.journalEntries, async () => {
    const existing = await getJournalEntry(date)
    const now = new Date().toISOString()
    const entry: JournalEntry = existing
      ? { ...existing, ...changes, updatedAt: now }
      : {
          id: crypto.randomUUID(),
          userId: LOCAL_USER_ID,
          date,
          doc: { type: 'doc', content: [{ type: 'paragraph' }] },
          mood: null,
          prompt,
          ...changes,
          createdAt: now,
          updatedAt: now,
        }
    await db.journalEntries.put(entry)
    return entry
  })
}

/** Whether a document has any words in it (an entry with only a mood still counts as written). */
export function docHasText(doc: NoteDoc | undefined): boolean {
  const walk = (node: unknown): boolean => {
    if (typeof node !== 'object' || node === null) return false
    const { text, content } = node as { text?: unknown; content?: unknown }
    if (typeof text === 'string' && text.trim()) return true
    return Array.isArray(content) && content.some(walk)
  }
  return walk(doc)
}
