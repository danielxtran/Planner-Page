import type { CategoryColor } from './categories'
import { db } from './db'
import { LOCAL_USER_ID } from './user'

/**
 * Sticky notes: a pad for quick thoughts, and a pile of the notes stuck aside.
 * Each sticky-notes widget has its own board (its id is in the widget's config),
 * so two widgets keep two separate piles.
 */

/** One widget's pad: what's being written right now, and its paper color. */
export interface StickyBoard {
  id: string
  userId: string
  /** Unfinished text on the pad, saved as you type so a refresh doesn't lose it. */
  draft: string
  color: CategoryColor
  createdAt: string
  updatedAt: string
}

/** A note that has been stuck aside. */
export interface StickyNote {
  id: string
  userId: string
  boardId: string
  text: string
  color: CategoryColor
  createdAt: string
  updatedAt: string
}

export const MAX_STICKY_LENGTH = 1000
export const DEFAULT_STICKY_COLOR: CategoryColor = 'butter'

/** A board that was never written to reads as an empty yellow pad; nothing is stored until then. */
export async function getStickyBoard(boardId: string): Promise<StickyBoard> {
  const board = await db.stickyBoards.get(boardId)
  if (board && board.userId === LOCAL_USER_ID) return board
  const now = new Date().toISOString()
  return {
    id: boardId,
    userId: LOCAL_USER_ID,
    draft: '',
    color: DEFAULT_STICKY_COLOR,
    createdAt: now,
    updatedAt: now,
  }
}

/** Newest first. */
export async function listStickyNotes(boardId: string): Promise<StickyNote[]> {
  const notes = await db.stickyNotes.where('boardId').equals(boardId).sortBy('createdAt')
  return notes.filter((n) => n.userId === LOCAL_USER_ID).reverse()
}

export async function saveStickyBoard(
  boardId: string,
  changes: Partial<Pick<StickyBoard, 'draft' | 'color'>>,
): Promise<StickyBoard> {
  if (changes.draft !== undefined)
    changes = { ...changes, draft: changes.draft.slice(0, MAX_STICKY_LENGTH) }
  return db.transaction('rw', db.stickyBoards, async () => {
    const board = await getStickyBoard(boardId)
    const updated = { ...board, ...changes, updatedAt: new Date().toISOString() }
    await db.stickyBoards.put(updated)
    return updated
  })
}

/**
 * Moves the pad's text onto a new note in the pile and clears the pad, in one
 * transaction, so a note is never both on the pad and in the pile (or in neither).
 */
export async function stickDraftAside(
  boardId: string,
): Promise<{ note: StickyNote; board: StickyBoard }> {
  return db.transaction('rw', db.stickyBoards, db.stickyNotes, async () => {
    const board = await getStickyBoard(boardId)
    const text = board.draft.trim()
    if (!text) throw new Error('The sticky note is empty')
    const now = new Date().toISOString()
    const note: StickyNote = {
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      boardId,
      text,
      color: board.color,
      createdAt: now,
      updatedAt: now,
    }
    await db.stickyNotes.add(note)
    const cleared = { ...board, draft: '', updatedAt: now }
    await db.stickyBoards.put(cleared)
    return { note, board: cleared }
  })
}

/** Undoes stickDraftAside: takes the note out of the pile and puts its text back on the pad. */
export async function unstickNote(note: StickyNote, draft: string): Promise<void> {
  await db.transaction('rw', db.stickyBoards, db.stickyNotes, async () => {
    await db.stickyNotes.delete(note.id)
    const board = await getStickyBoard(note.boardId)
    await db.stickyBoards.put({ ...board, draft, updatedAt: new Date().toISOString() })
  })
}

export async function deleteStickyNote(id: string): Promise<StickyNote> {
  return db.transaction('rw', db.stickyNotes, async () => {
    const note = await db.stickyNotes.get(id)
    if (!note || note.userId !== LOCAL_USER_ID) throw new Error(`Sticky note not found: ${id}`)
    await db.stickyNotes.delete(id)
    return note
  })
}

/** Puts a deleted note back exactly as it was (same id, same date), for undo. */
export async function restoreStickyNote(note: StickyNote): Promise<void> {
  await db.stickyNotes.put(note)
}
