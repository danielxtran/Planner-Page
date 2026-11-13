import { describe, expect, it } from 'vitest'
import { db } from './db'
import {
  deleteStickyNote,
  getStickyBoard,
  listStickyNotes,
  restoreStickyNote,
  saveStickyBoard,
  stickDraftAside,
  unstickNote,
} from './stickies'

describe('sticky notes storage', () => {
  it('reads an unused board as an empty yellow pad without storing it', async () => {
    expect(await getStickyBoard('b1')).toMatchObject({ draft: '', color: 'butter' })
    expect(await db.stickyBoards.count()).toBe(0)
  })

  it('saves the pad text and color', async () => {
    await saveStickyBoard('b1', { draft: 'half a thought', color: 'mint' })
    expect(await getStickyBoard('b1')).toMatchObject({ draft: 'half a thought', color: 'mint' })
  })

  it('sticks the pad text aside as a note and clears the pad, together', async () => {
    await saveStickyBoard('b1', { draft: '  Buy stamps  ', color: 'rose' })
    const { note } = await stickDraftAside('b1')

    expect(note).toMatchObject({ boardId: 'b1', text: 'Buy stamps', color: 'rose' })
    expect((await getStickyBoard('b1')).draft).toBe('')
    expect(await listStickyNotes('b1')).toEqual([note])
  })

  it('refuses to stick an empty pad', async () => {
    await saveStickyBoard('b1', { draft: '   ' })
    await expect(stickDraftAside('b1')).rejects.toThrow('empty')
    expect(await listStickyNotes('b1')).toEqual([])
  })

  it('lists one board’s notes, newest first', async () => {
    for (const text of ['first', 'second']) {
      await saveStickyBoard('b1', { draft: text })
      await stickDraftAside('b1')
      // Distinct timestamps, so the order is certain.
      await new Promise((r) => setTimeout(r, 5))
    }
    await saveStickyBoard('other', { draft: 'elsewhere' })
    await stickDraftAside('other')

    expect((await listStickyNotes('b1')).map((n) => n.text)).toEqual(['second', 'first'])
  })

  it('unsticks a note back onto the pad, and deletes and restores notes', async () => {
    await saveStickyBoard('b1', { draft: 'Idea' })
    const { note } = await stickDraftAside('b1')

    await unstickNote(note, 'Idea')
    expect(await listStickyNotes('b1')).toEqual([])
    expect((await getStickyBoard('b1')).draft).toBe('Idea')

    const again = (await stickDraftAside('b1')).note
    const deleted = await deleteStickyNote(again.id)
    expect(await listStickyNotes('b1')).toEqual([])
    await restoreStickyNote(deleted)
    expect(await listStickyNotes('b1')).toEqual([again])
  })
})
