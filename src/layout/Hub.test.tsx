import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '../storage/db'
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
})
