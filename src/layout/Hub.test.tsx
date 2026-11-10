import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '../storage/db'
import { readTodoConfig } from '../widgets/todo/todoConfig'
import { Hub } from './Hub'
import { initialLayoutState, useLayoutStore } from './layoutStore'

async function renderHub() {
  const result = render(<Hub />)
  await screen.findByRole('heading', { name: 'To-do' })
  return result
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const row = (n: number) => screen.getByRole('group', { name: `Row ${n}` })
const todoHeadings = () => screen.getAllByRole('heading', { name: 'To-do' })

async function savedRows() {
  const [page] = await db.pages.toArray()
  return page.rows
}

function startEditing() {
  fireEvent.click(button('Edit layout'))
}

describe('Hub', () => {
  it('starts with one full-width to-do widget and no editing controls', async () => {
    await renderHub()
    expect(todoHeadings()).toHaveLength(1)
    expect(screen.queryByRole('group', { name: 'Row 1' })).toBeNull()
    expect(screen.queryByRole('button', { name: /add row/i })).toBeNull()
  })

  it('shows and hides editing controls', async () => {
    await renderHub()
    startEditing()
    expect(row(1)).toBeInTheDocument()
    expect(button('One full-width column')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(button('Done editing'))
    expect(screen.queryByRole('group', { name: 'Row 1' })).toBeNull()
  })

  it('adds a row, changes its columns, and saves', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('+ Add row'))
    await waitFor(() => expect(row(2)).toBeInTheDocument())

    fireEvent.click(within(row(2)).getByRole('button', { name: '3 columns, 4 + 4 + 4 twelfths' }))

    await waitFor(() =>
      expect(within(row(2)).getAllByRole('button', { name: /add widget to/i })).toHaveLength(3),
    )
    const rows = await savedRows()
    expect(rows.map((r) => r.columns.map((c) => c.width))).toEqual([[12], [4, 4, 4]])
  })

  it('adds a second to-do widget that shares tasks with the first', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('+ Add row'))
    fireEvent.click(await screen.findByRole('button', { name: 'Add widget to column 1 of row 2' }))
    fireEvent.click(button(/^To-do list/))
    await waitFor(() => expect(todoHeadings()).toHaveLength(2))

    const [firstInput] = screen.getAllByRole('textbox', { name: 'New task' })
    fireEvent.change(firstInput, { target: { value: 'Shared task' } })
    fireEvent.submit(firstInput)

    // Both widgets read the same task store, so the task appears in each.
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: 'Shared task' })).toHaveLength(2),
    )
  })

  it('resizes columns with the arrow keys and saves', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('2 columns, 6 + 6 twelfths'))
    const divider = await screen.findByRole('separator', {
      name: 'Resize columns 1 and 2 of row 1',
    })
    expect(divider).toHaveAttribute('aria-valuenow', '6')

    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    fireEvent.keyDown(divider, { key: 'ArrowRight' })

    await waitFor(() => expect(divider).toHaveAttribute('aria-valuenow', '8'))
    await waitFor(async () =>
      expect((await savedRows())[0].columns.map((c) => c.width)).toEqual([8, 4]),
    )
  })

  it('stops resizing at the minimum width', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('2 columns, 8 + 4 twelfths'))
    const divider = await screen.findByRole('separator')
    for (let i = 0; i < 5; i++) fireEvent.keyDown(divider, { key: 'ArrowRight' })
    await waitFor(() => expect(divider).toHaveAttribute('aria-valuenow', '10'))
  })

  it('removes a widget and undoes it', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('Remove To-do list widget'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'To-do' })).toBeNull())
    // The layout updates before the save finishes; the undo step appears once it's saved.
    expect(await screen.findByText('Last: remove To-do list')).toBeInTheDocument()

    fireEvent.click(button(/undo/i))
    expect(await screen.findByRole('heading', { name: 'To-do' })).toBeInTheDocument()
    expect((await savedRows())[0].columns[0].widgets).toHaveLength(1)
  })

  it('keeps widgets when a row goes down to fewer columns', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('2 columns, 6 + 6 twelfths'))
    fireEvent.click(await screen.findByRole('button', { name: 'Add widget to column 2 of row 1' }))
    fireEvent.click(button(/^To-do list/))
    await waitFor(() => expect(todoHeadings()).toHaveLength(2))

    fireEvent.click(button('One full-width column'))

    await waitFor(async () => expect((await savedRows())[0].columns).toHaveLength(1))
    expect(todoHeadings()).toHaveLength(2)
  })

  it('removes a row, and the empty hub explains what to do', async () => {
    await renderHub()
    startEditing()
    fireEvent.click(button('Remove row 1'))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Row 1' })).toBeNull())

    fireEvent.click(button('Done editing'))
    expect(screen.getByText(/your hub is empty/i)).toBeInTheDocument()
  })

  it('keeps the layout after a refresh', async () => {
    const { unmount } = await renderHub()
    startEditing()
    fireEvent.click(button('+ Add row'))
    await waitFor(async () => expect(await savedRows()).toHaveLength(2))

    unmount()
    useLayoutStore.setState(initialLayoutState)
    render(<Hub />)
    await screen.findByRole('heading', { name: 'To-do' })
    fireEvent.click(button('Edit layout'))
    expect(row(2)).toBeInTheDocument()
  })

  describe('saved filters (milestone 4)', () => {
    async function addTask(title: string) {
      const input = screen.getAllByRole('textbox', { name: 'New task' })[0]
      fireEvent.change(input, { target: { value: title } })
      fireEvent.submit(input)
      await screen.findAllByRole('checkbox', { name: title })
    }

    const savedTodoConfigs = async () =>
      (await savedRows()).flatMap((r) =>
        r.columns.flatMap((c) => c.widgets.map((w) => readTodoConfig(w.config))),
      )

    it("saves a widget's filter in the layout, and undoes a change", async () => {
      await renderHub()
      await addTask('Read chapter 3')
      fireEvent.click(button(/^Filters/))
      fireEvent.click(button('To do'))

      await waitFor(async () => expect((await savedTodoConfigs())[0].filter.status).toBe('open'))
      expect(await screen.findByText('Last: change filter')).toBeInTheDocument()

      fireEvent.click(button(/undo/i))
      await waitFor(async () => expect((await savedTodoConfigs())[0].filter.status).toBe('all'))
    })

    it('saves a filter as a new widget below, titled after the filter', async () => {
      await renderHub()
      await addTask('Read chapter 3')
      fireEvent.click(button(/^Filters/))
      fireEvent.click(button('Next 7 days'))
      fireEvent.click(await screen.findByRole('button', { name: '+ Save as widget' }))

      expect(await screen.findByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument()
      const configs = await savedTodoConfigs()
      expect(configs).toHaveLength(2)
      expect(configs[1]).toMatchObject({ title: 'Next 7 days', filter: { due: 'next7' } })
    })

    it('renames a widget', async () => {
      await renderHub()
      fireEvent.click(button('Rename "To-do"'))
      const input = screen.getByRole('textbox', { name: 'Widget title' })
      fireEvent.change(input, { target: { value: 'School' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(await screen.findByRole('heading', { name: 'School' })).toBeInTheDocument()
      await waitFor(async () => expect((await savedTodoConfigs())[0].title).toBe('School'))
      // In edit mode the widget now goes by its new name.
      startEditing()
      expect(button('Move School widget')).toBeInTheDocument()
    })

    it('fills in quick-add from the filter so new tasks stay visible', async () => {
      await renderHub()
      await addTask('Something')
      fireEvent.click(button(/^Filters/))
      fireEvent.click(button('Top'))
      await waitFor(async () =>
        expect((await savedTodoConfigs())[0].filter.priorities).toEqual([1]),
      )

      await addTask('Urgent thing')
      expect(screen.queryByText(/your filters are hiding it/)).toBeNull()
      const added = (await db.tasks.toArray()).find((t) => t.title === 'Urgent thing')
      expect(added?.priority).toBe(1)
    })
  })

  describe('notes and themes (milestone 5)', () => {
    it('adds a notes widget', async () => {
      await renderHub()
      startEditing()
      fireEvent.click(button('Add widget to column 1 of row 1'))
      fireEvent.click(button(/^Notes/))
      expect(await screen.findByRole('heading', { name: 'Notes' })).toBeInTheDocument()
      expect(await screen.findByRole('textbox', { name: 'Notes text' })).toBeInTheDocument()
      const widgets = (await savedRows())[0].columns[0].widgets
      expect(widgets.map((w) => w.type)).toEqual(['todo', 'notes'])
      expect(widgets[1].config.noteId).toEqual(expect.any(String))
    })

    it('holds two notes widgets, each with its own note', async () => {
      await renderHub()
      startEditing()
      for (let i = 0; i < 2; i++) {
        fireEvent.click(button('Add widget to column 1 of row 1'))
        fireEvent.click(button(/^Notes/))
      }
      await waitFor(() =>
        expect(screen.getAllByRole('textbox', { name: 'Notes text' })).toHaveLength(2),
      )
      const notes = (await savedRows())[0].columns[0].widgets.filter((w) => w.type === 'notes')
      expect(notes).toHaveLength(2)
      expect(notes[0].config.noteId).not.toBe(notes[1].config.noteId)
    })

    it('switches theme, saves it, and undoes it', async () => {
      await renderHub()
      expect(document.documentElement.dataset.theme).toBe('graph')

      fireEvent.click(button('Bullet journal'))
      await waitFor(() => expect(document.documentElement.dataset.theme).toBe('bujo'))
      expect(button('Bullet journal')).toHaveAttribute('aria-pressed', 'true')
      expect(await screen.findByText('Last: change theme')).toBeInTheDocument()
      expect((await db.pages.toArray())[0].theme).toBe('bujo')

      fireEvent.click(button(/undo/i))
      await waitFor(() => expect(document.documentElement.dataset.theme).toBe('graph'))
      expect((await db.pages.toArray())[0].theme).toBe('graph')
    })
  })
})
