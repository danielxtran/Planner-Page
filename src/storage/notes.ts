import { db } from './db'
import { LOCAL_USER_ID } from './user'

/**
 * A rich-text document as JSON, in the shape the editor (TipTap/ProseMirror)
 * produces: `{ type: 'doc', content: [...] }`. Stored as JSON rather than HTML
 * so nothing saved can run as markup when it's loaded back, and so a later
 * move to Supabase can keep it in a JSON column as-is.
 */
export interface NoteDoc {
  type: 'doc'
  content?: unknown[]
}

export interface Note {
  id: string
  userId: string
  doc: NoteDoc
  createdAt: string
  updatedAt: string
}

export const EMPTY_NOTE_DOC: NoteDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export async function getNote(id: string): Promise<Note | undefined> {
  const note = await db.notes.get(id)
  return note?.userId === LOCAL_USER_ID ? note : undefined
}

/**
 * Saves a note's contents, creating the note the first time. A new notes widget
 * gets its note id up front but no record until something is written, so
 * adding and then removing an empty widget leaves nothing behind.
 */
export async function saveNote(id: string, doc: NoteDoc): Promise<Note> {
  if (!id) throw new Error('Note id is required')
  assertValidDoc(doc)
  return db.transaction('rw', db.notes, async () => {
    const existing = await db.notes.get(id)
    if (existing && existing.userId !== LOCAL_USER_ID) throw new Error(`Note not found: ${id}`)
    const now = new Date().toISOString()
    const note: Note = existing
      ? { ...existing, doc, updatedAt: now }
      : { id, userId: LOCAL_USER_ID, doc, createdAt: now, updatedAt: now }
    await db.notes.put(note)
    return note
  })
}

function assertValidDoc(doc: NoteDoc) {
  if (typeof doc !== 'object' || doc === null || doc.type !== 'doc') {
    throw new Error('Note contents must be a document')
  }
  if (doc.content !== undefined && !Array.isArray(doc.content)) {
    throw new Error('Note contents must be a list of blocks')
  }
}
