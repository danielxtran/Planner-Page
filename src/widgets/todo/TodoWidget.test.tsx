import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { TodoWidget } from './TodoWidget'

beforeEach(async () => {
  await db.tasks.clear()
})

async function addViaQuickAdd(title: string) {
  const input = screen.getByRole('textbox', { name: 'New task' })
  fireEvent.change(input, { target: { value: title } })
  fireEvent.submit(input)
  await screen.findByRole('checkbox', { name: title })
}

describe('TodoWidget', () => {
  it('quick-adds a task, clears the box, and keeps it after a remount', async () => {
    const { unmount } = render(<TodoWidget />)
    await screen.findByText('Nothing to do. Enjoy it!')

    await addViaQuickAdd('Buy washi tape')
    expect(screen.getByRole('textbox', { name: 'New task' })).toHaveValue('')

    // A fresh mount reads from IndexedDB again, like a page refresh.
    unmount()
    render(<TodoWidget />)
    expect(await screen.findByRole('checkbox', { name: 'Buy washi tape' })).not.toBeChecked()
  })

  it('checks off, deletes, and undoes in reverse order', async () => {
    render(<TodoWidget />)
    await screen.findByText('Nothing to do. Enjoy it!')
    await addViaQuickAdd('Stretch')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Stretch' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Stretch' })).toBeChecked())

    fireEvent.click(screen.getByRole('button', { name: 'Delete "Stretch"' }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Stretch' })).toBeNull())

    // Undo the delete: the task comes back, still checked.
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(await screen.findByRole('checkbox', { name: 'Stretch' })).toBeChecked()

    // Undo the check, via the keyboard shortcut this time.
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Stretch' })).not.toBeChecked())
  })

  describe('editing a title', () => {
    function startEditing(title: string) {
      fireEvent.click(screen.getByRole('button', { name: `Edit "${title}"` }))
      return screen.getByRole('textbox', { name: `Edit title of "${title}"` })
    }

    beforeEach(async () => {
      render(<TodoWidget />)
      await screen.findByText('Nothing to do. Enjoy it!')
      await addViaQuickAdd('Wtaer plants')
    })

    it('saves on Enter, persists, and returns focus to the edit button', async () => {
      const input = startEditing('Wtaer plants')
      expect(input).toHaveFocus()
      fireEvent.change(input, { target: { value: '  Water plants ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(await screen.findByRole('checkbox', { name: 'Water plants' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit "Water plants"' })).toHaveFocus()
      expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Water plants'])
    })

    it('saves when the field loses focus', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Water plants' } })
      fireEvent.blur(input)

      expect(await screen.findByRole('checkbox', { name: 'Water plants' })).toBeInTheDocument()
    })

    it('cancels on Escape without saving', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Something else' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.getByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
      expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Wtaer plants'])
    })

    it('treats a cleared title as cancel, not delete', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(screen.getByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('can be undone', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Water plants' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await screen.findByRole('checkbox', { name: 'Water plants' })

      fireEvent.click(screen.getByRole('button', { name: /undo/i }))
      expect(await screen.findByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
    })
  })
})
