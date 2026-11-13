import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UndoControls } from '../../layout/UndoControls'
import { getStickyBoard, listStickyNotes } from '../../storage/stickies'
import { StickyNotesWidget } from './StickyNotesWidget'
import { useStickyStore } from './stickyStore'

const widget = { id: 'w1', type: 'stickies', config: { boardId: 'b1' } }

function renderWidget() {
  return render(
    <>
      <UndoControls />
      <StickyNotesWidget widget={widget} onConfigChange={() => {}} onAddBelow={() => {}} />
    </>,
  )
}

const pad = () => screen.findByRole('textbox', { name: 'Sticky notes: new note' })

async function write(text: string) {
  const box = await pad()
  fireEvent.focus(box)
  fireEvent.change(box, { target: { value: text } })
  return box
}

describe('StickyNotesWidget', () => {
  it('sticks a note aside: the pad clears and the pile counts it', async () => {
    renderWidget()
    expect(await screen.findByText('Stuck notes pile up here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stick it aside/i })).toBeDisabled()

    await write('Email the TA about lab 3')
    fireEvent.click(screen.getByRole('button', { name: /stick it aside/i }))

    expect(await screen.findByRole('button', { name: /show all 1 note/i })).toBeInTheDocument()
    expect(await pad()).toHaveValue('')
    expect((await listStickyNotes('b1')).map((n) => n.text)).toEqual(['Email the TA about lab 3'])
  })

  it('sticks with Ctrl+Enter too', async () => {
    renderWidget()
    const box = await write('Quick one')
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    expect(await screen.findByRole('button', { name: /show all 1 note/i })).toBeInTheDocument()
  })

  it('shows every note, deletes one, and undo brings it back', async () => {
    renderWidget()
    for (const text of ['Buy stamps', 'Call grandma']) {
      const box = await write(text)
      fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
      await waitFor(async () => expect(await pad()).toHaveValue(''))
    }

    fireEvent.click(await screen.findByRole('button', { name: /show all 2 notes/i }))
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Delete note "Buy stamps"' }))
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))
    expect(await screen.findByText('Last: delete sticky note')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    await waitFor(() =>
      expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2),
    )
  })

  it('undoing "stick it aside" puts the text back on the pad', async () => {
    renderWidget()
    const box = await write('Not done yet')
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    expect(await screen.findByText('Last: stick note aside')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    await waitFor(async () => expect(await pad()).toHaveValue('Not done yet'))
    expect(await listStickyNotes('b1')).toEqual([])
  })

  it('saves unfinished text, so it is still there after a refresh', async () => {
    const { unmount } = renderWidget()
    await write('Half a thought')
    // Saved by the timer, without leaving the pad.
    await waitFor(async () => expect((await getStickyBoard('b1')).draft).toBe('Half a thought'))

    unmount()
    useStickyStore.setState({ boards: {} })
    renderWidget()
    expect(await pad()).toHaveValue('Half a thought')
  })

  it('one undo step per stretch of typing', async () => {
    renderWidget()
    const box = await write('First draft')
    fireEvent.blur(box)
    expect(await screen.findByText('Last: edit sticky note')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    await waitFor(async () => expect(await pad()).toHaveValue(''))
  })

  it('changes the paper color, and the next note keeps it', async () => {
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'mint' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'mint' })).toHaveAttribute('aria-pressed', 'true'),
    )
    const box = await write('Green thought')
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    await waitFor(async () => expect((await listStickyNotes('b1'))[0]?.color).toBe('mint'))
  })
})
