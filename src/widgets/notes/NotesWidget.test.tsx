import type { Editor } from '@tiptap/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { UndoControls } from '../../layout/UndoControls'
import { useUndoStore } from '../../state/undoStore'
import { getNote, saveNote, type NoteDoc } from '../../storage/notes'
import { NotesWidget } from './NotesWidget'

const doc = (text: string): NoteDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

/** The widget with its settings in React state, standing in for the page layout. */
function StandaloneNotes() {
  const [config, setConfig] = useState<Record<string, unknown>>({ noteId: 'n1' })
  return (
    <>
      <UndoControls />
      <NotesWidget
        widget={{ id: 'w1', type: 'notes', config }}
        onConfigChange={(_label, next) => setConfig(next)}
        onAddBelow={() => {}}
      />
    </>
  )
}

/**
 * jsdom can't type into a contenteditable the way a browser does, so tests
 * drive the editor through its commands. TipTap puts the editor instance on
 * its DOM element for exactly this kind of access.
 */
async function getEditor() {
  const box = await screen.findByRole('textbox', { name: 'Notes text' })
  return (box as HTMLElement & { editor: Editor }).editor
}

/** TipTap focuses on the next animation frame, so wait until the editor really has focus. */
async function focusEditor(editor: Editor) {
  act(() => {
    editor.commands.focus('end')
  })
  await waitFor(() => expect(editor.isFocused).toBe(true))
}

const savedText = async () => JSON.stringify((await getNote('n1'))?.doc ?? null)

describe('NotesWidget', () => {
  it('shows a saved note', async () => {
    await saveNote('n1', doc('Remember the milk'))
    render(<StandaloneNotes />)
    expect(await screen.findByText('Remember the milk')).toBeInTheDocument()
  })

  it('starts empty without creating a record until something is written', async () => {
    render(<StandaloneNotes />)
    const editor = await getEditor()
    expect(editor.isEmpty).toBe(true)
    expect(await getNote('n1')).toBeUndefined()
  })

  it('saves shortly after typing, and one undo step covers the editing stretch', async () => {
    await saveNote('n1', doc('First'))
    render(<StandaloneNotes />)
    const editor = await getEditor()
    await focusEditor(editor)

    act(() => {
      editor.commands.insertContent(' draft')
      editor.commands.insertContent(' two')
    })
    // Saved by the autosave timer while still focused, before any blur.
    await waitFor(async () => expect(await savedText()).toContain('First draft two'))
    expect(useUndoStore.getState().entries).toEqual([])

    act(() => {
      editor.commands.blur()
    })
    expect(await screen.findByText('Last: edit Notes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    // The undo restores the text from before the stretch, in storage and on screen.
    await waitFor(async () => expect(await savedText()).toBe(JSON.stringify(doc('First'))))
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.queryByText(/draft/)).toBeNull()
  })

  it('saves a change made without focusing the note (like ticking a box) right away', async () => {
    await saveNote('n1', doc('Plain'))
    render(<StandaloneNotes />)
    const editor = await getEditor()

    act(() => {
      editor.commands.insertContent('More ')
    })

    await waitFor(async () => expect(await savedText()).toContain('More Plain'))
    expect(await screen.findByText('Last: edit Notes')).toBeInTheDocument()
  })

  it('formats with the toolbar', async () => {
    render(<StandaloneNotes />)
    const editor = await getEditor()
    await focusEditor(editor)
    act(() => {
      editor.commands.insertContent('Groceries')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }))
    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heading' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))
    expect(editor.isActive('taskList')).toBe(true)
  })

  it('adds a link and refuses unsafe ones', async () => {
    render(<StandaloneNotes />)
    await focusEditor(await getEditor())

    fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
    const address = screen.getByRole('textbox', { name: 'Link address' })
    fireEvent.change(address, { target: { value: 'javascript:alert(1)' } })
    fireEvent.submit(address)
    expect(address).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(address, { target: { value: 'example.com' } })
    fireEvent.submit(address)
    expect(await screen.findByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })

  it('renames the widget', async () => {
    render(<StandaloneNotes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename "Notes"' }))
    const input = screen.getByRole('textbox', { name: 'Widget title' })
    fireEvent.change(input, { target: { value: 'Ideas' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('heading', { name: 'Ideas' })).toBeInTheDocument()
    expect(await screen.findByRole('textbox', { name: 'Ideas text' })).toBeInTheDocument()
  })
})
