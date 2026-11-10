import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { getNote, saveNote, type NoteDoc } from './notes'
import { LOCAL_USER_ID } from './user'

const doc = (text: string): NoteDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('notes', () => {
  it('has nothing for a note that was never written', async () => {
    expect(await getNote('n1')).toBeUndefined()
  })

  it('creates the note on first save', async () => {
    const note = await saveNote('n1', doc('Hello'))
    expect(note).toEqual({
      id: 'n1',
      userId: LOCAL_USER_ID,
      doc: doc('Hello'),
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    })
    expect(await getNote('n1')).toEqual(note)
  })

  it('updates the contents later, keeping createdAt', async () => {
    await saveNote('n1', doc('Hello'))
    vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'))

    const note = await saveNote('n1', doc('Hello again'))

    expect(note.doc).toEqual(doc('Hello again'))
    expect(note.createdAt).toBe('2026-01-01T09:00:00.000Z')
    expect(note.updatedAt).toBe('2026-01-02T09:00:00.000Z')
    expect(await db.notes.count()).toBe(1)
  })

  it('rejects something that is not a document', async () => {
    await expect(saveNote('n1', { type: 'paragraph' } as unknown as NoteDoc)).rejects.toThrow(
      'must be a document',
    )
    await expect(saveNote('', doc('x'))).rejects.toThrow('id is required')
    expect(await db.notes.count()).toBe(0)
  })

  it("doesn't return another user's note", async () => {
    await db.notes.add({
      ...(await saveNote('n1', doc('x'))),
      id: 'theirs',
      userId: 'someone-else',
    })
    expect(await getNote('theirs')).toBeUndefined()
  })
})
