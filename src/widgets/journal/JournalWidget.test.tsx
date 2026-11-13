import type { Editor } from '@tiptap/react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { UndoControls } from '../../layout/UndoControls'
import { getJournalEntry, saveJournalEntry } from '../../storage/journal'
import { localDate } from '../calendar/syncWindow'
import { nextPrompt, promptFor, PROMPTS } from './journalData'
import { JournalWidget } from './JournalWidget'

const today = localDate(new Date())
const yesterday = localDate(addDays(new Date(), -1))

function renderJournal() {
  return render(
    <>
      <UndoControls />
      <JournalWidget
        widget={{ id: 'w1', type: 'journal', config: {} }}
        onConfigChange={() => {}}
        onAddBelow={() => {}}
      />
    </>,
  )
}

const moodButton = (label: string) =>
  within(screen.getByRole('group', { name: 'Mood' })).getByRole('button', { name: label })

describe('journal prompts', () => {
  it('gives the same prompt all day, and a different one on "Another prompt"', () => {
    expect(promptFor('2026-11-13')).toBe(promptFor('2026-11-13'))
    expect(PROMPTS).toContain(promptFor('2026-11-14'))
    expect(nextPrompt(PROMPTS[0])).toBe(PROMPTS[1])
    expect(nextPrompt(PROMPTS[PROMPTS.length - 1])).toBe(PROMPTS[0])
  })
})

describe('JournalWidget', () => {
  it("shows today's prompt and saves a mood, undoably; clicking it again clears it", async () => {
    renderJournal()
    expect(await screen.findByText(promptFor(today))).toBeInTheDocument()

    fireEvent.click(moodButton('Good'))
    await waitFor(() => expect(moodButton('Good')).toHaveAttribute('aria-pressed', 'true'))
    expect((await getJournalEntry(today))?.mood).toBe('good')

    fireEvent.click(await screen.findByRole('button', { name: /undo/i }))
    await waitFor(() => expect(moodButton('Good')).toHaveAttribute('aria-pressed', 'false'))

    fireEvent.click(moodButton('Rough'))
    await waitFor(() => expect(moodButton('Rough')).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(moodButton('Rough'))
    await waitFor(async () => expect((await getJournalEntry(today))?.mood).toBeNull())
  })

  it('swaps the prompt and keeps it with the entry', async () => {
    renderJournal()
    const first = promptFor(today)
    await screen.findByText(first)
    fireEvent.click(screen.getByRole('button', { name: 'Another prompt' }))

    expect(await screen.findByText(nextPrompt(first))).toBeInTheDocument()
    expect((await getJournalEntry(today))?.prompt).toBe(nextPrompt(first))
  })

  it("saves writing to today's entry", async () => {
    renderJournal()
    const box = await screen.findByRole('textbox', { name: /Journal for/ })
    const editor = (box as HTMLElement & { editor: Editor }).editor
    act(() => {
      // Written without focusing, which saves right away (see NoteEditor).
      editor.commands.insertContent('Long day, good soup.')
    })
    await waitFor(async () =>
      expect(JSON.stringify((await getJournalEntry(today))?.doc)).toContain('good soup'),
    )
  })

  it('goes back a day to read an older entry, and back to today', async () => {
    await saveJournalEntry(
      yesterday,
      {
        mood: 'low',
        doc: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rainy.' }] }],
        },
      },
      'Old prompt',
    )
    renderJournal()
    await screen.findByText(promptFor(today))
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('Old prompt')).toBeInTheDocument()
    expect(await screen.findByText('Rainy.')).toBeInTheDocument()
    expect(moodButton('Low')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(await screen.findByText(promptFor(today))).toBeInTheDocument()
  })

  it('shows past entries on a calendar, with moods, and opens a day from it', async () => {
    await saveJournalEntry(yesterday, { mood: 'great' }, 'Old prompt')
    renderJournal()
    await screen.findByText(promptFor(today))
    fireEvent.click(screen.getByRole('button', { name: 'Past entries' }))

    // Yesterday may be in last month (on the 1st); go there if needed.
    if (yesterday.slice(0, 7) !== today.slice(0, 7)) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    }
    const day = screen.getByRole('button', {
      name: `${format(addDays(new Date(), -1), 'EEEE, MMMM d')}, mood Great`,
    })
    fireEvent.click(day)
    expect(await screen.findByText('Old prompt')).toBeInTheDocument()

    // You can't go on to months that haven't happened yet.
    if (yesterday.slice(0, 7) === today.slice(0, 7)) {
      expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    }
  })
})
