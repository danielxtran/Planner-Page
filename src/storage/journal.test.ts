import { describe, expect, it } from 'vitest'
import { db } from './db'
import { docHasText, getJournalEntry, listJournalEntries, saveJournalEntry } from './journal'
import type { NoteDoc } from './notes'

const doc = (text: string): NoteDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
})

describe('journal storage', () => {
  it('creates a day’s entry the first time, with the prompt shown that day', async () => {
    expect(await getJournalEntry('2026-11-13')).toBeUndefined()
    const entry = await saveJournalEntry('2026-11-13', { mood: 'good' }, 'What made you smile?')
    expect(entry).toMatchObject({
      date: '2026-11-13',
      mood: 'good',
      prompt: 'What made you smile?',
      doc: { type: 'doc' },
    })
  })

  it('updates the same entry afterwards: one per day', async () => {
    await saveJournalEntry('2026-11-13', { mood: 'good' }, 'P1')
    await saveJournalEntry('2026-11-13', { doc: doc('Nice walk') }, 'P2')

    const entries = await listJournalEntries()
    expect(entries).toHaveLength(1)
    // The prompt is kept from when the entry was made, unless changed on purpose.
    expect(entries[0]).toMatchObject({ mood: 'good', prompt: 'P1', doc: doc('Nice walk') })
  })

  it('refuses a second entry for the same day at the database level', async () => {
    const entry = await saveJournalEntry('2026-11-13', {}, 'P')
    await expect(db.journalEntries.add({ ...entry, id: 'another' })).rejects.toThrow()
  })

  it('lists entries by date, and rejects bad dates and moods', async () => {
    await saveJournalEntry('2026-11-13', {}, 'P')
    await saveJournalEntry('2026-11-01', {}, 'P')
    expect((await listJournalEntries()).map((e) => e.date)).toEqual(['2026-11-01', '2026-11-13'])

    await expect(saveJournalEntry('Nov 13', {}, 'P')).rejects.toThrow('Bad journal date')
    await expect(
      saveJournalEntry('2026-11-13', { mood: 'ecstatic' as never }, 'P'),
    ).rejects.toThrow('Unknown mood')
  })
})

describe('docHasText', () => {
  it('finds words anywhere in a document', () => {
    expect(docHasText(doc(''))).toBe(false)
    expect(docHasText(doc('   '))).toBe(false)
    expect(docHasText(doc('Hi'))).toBe(true)
    expect(
      docHasText({
        type: 'doc',
        content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [doc('deep')] }] }],
      }),
    ).toBe(true)
  })
})
