import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { addDaysTo, todayString } from './dates'
import { TodoWidget } from './TodoWidget'

beforeEach(async () => {
  await Promise.all([db.tasks.clear(), db.categories.clear()])
})

async function renderWidget() {
  const result = render(<TodoWidget />)
  await screen.findByText('Nothing to do. Enjoy it!')
  return result
}

const addForm = () => screen.getByRole('form', { name: 'Add task' })

async function addViaQuickAdd(title: string) {
  const input = screen.getByRole('textbox', { name: 'New task' })
  fireEvent.change(input, { target: { value: title } })
  fireEvent.submit(input)
  await screen.findByRole('checkbox', { name: title })
}

/** Picks "+ New category…" in a category dropdown, types a name, and presses Enter. */
async function createCategoryIn(container: HTMLElement, name: string) {
  fireEvent.change(within(container).getByRole('combobox', { name: 'Category' }), {
    target: { value: '__new__' },
  })
  const nameInput = within(container).getByRole('textbox', { name: 'New category name' })
  fireEvent.change(nameInput, { target: { value: name } })
  fireEvent.keyDown(nameInput, { key: 'Enter' })
  await waitFor(() =>
    expect(within(container).getByRole('combobox', { name: 'Category' })).toHaveDisplayValue(name),
  )
}

describe('TodoWidget', () => {
  it('quick-adds a task, clears the box, and keeps it after a remount', async () => {
    const { unmount } = await renderWidget()

    await addViaQuickAdd('Buy washi tape')
    expect(screen.getByRole('textbox', { name: 'New task' })).toHaveValue('')

    // A fresh mount reads from IndexedDB again, like a page refresh.
    unmount()
    render(<TodoWidget />)
    expect(await screen.findByRole('checkbox', { name: 'Buy washi tape' })).not.toBeChecked()
  })

  it('checks off, deletes, and undoes in reverse order', async () => {
    await renderWidget()
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

  it('quick-adds with priority, a new category, and a due date', async () => {
    await renderWidget()
    const form = addForm()
    const tomorrow = addDaysTo(todayString(), 1)

    fireEvent.change(within(form).getByRole('combobox', { name: 'Priority' }), {
      target: { value: '1' },
    })
    await createCategoryIn(form, 'School')
    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: tomorrow } })
    await addViaQuickAdd('Essay draft')

    const checkbox = screen.getByRole('checkbox', { name: 'Essay draft' })
    expect(checkbox).toHaveAccessibleDescription('Top priority, School, due Tomorrow')
    // The pickers reset for the next task.
    expect(within(form).getByRole('combobox', { name: 'Priority' })).toHaveValue('4')
    expect(within(form).getByRole('combobox', { name: 'Category' })).toHaveDisplayValue(
      'No category',
    )

    const [saved] = await db.tasks.toArray()
    expect(saved).toMatchObject({ title: 'Essay draft', priority: 1, dueDate: tomorrow })
    expect((await db.categories.get(saved.categoryId!))?.name).toBe('School')
  })

  it('filters by priority and shows how many are hidden', async () => {
    await renderWidget()
    fireEvent.change(within(addForm()).getByRole('combobox', { name: 'Priority' }), {
      target: { value: '1' },
    })
    await addViaQuickAdd('Urgent thing')
    await addViaQuickAdd('Someday thing')

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Top' }))

    expect(screen.getByRole('checkbox', { name: 'Urgent thing' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Someday thing' })).toBeNull()
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('checkbox', { name: 'Someday thing' })).toBeInTheDocument()
  })

  it('says so when a newly added task is hidden by the filters', async () => {
    await renderWidget()
    await addViaQuickAdd('Visible')
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    const input = screen.getByRole('textbox', { name: 'New task' })
    fireEvent.change(input, { target: { value: 'Sneaky' } })
    fireEvent.submit(input)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added "Sneaky", but your filters are hiding it.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getByRole('checkbox', { name: 'Sneaky' })).toBeInTheDocument()
  })

  describe('editing', () => {
    function startEditing(title: string) {
      fireEvent.click(screen.getByRole('button', { name: `Edit "${title}"` }))
      return screen.getByRole('textbox', { name: `Edit title of "${title}"` })
    }

    beforeEach(async () => {
      await renderWidget()
      await addViaQuickAdd('Wtaer plants')
    })

    it('saves on Enter, persists, and returns focus to the edit button', async () => {
      const input = startEditing('Wtaer plants')
      expect(input).toHaveFocus()
      fireEvent.change(input, { target: { value: '  Water plants ' } })
      fireEvent.submit(input)

      expect(await screen.findByRole('checkbox', { name: 'Water plants' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit "Water plants"' })).toHaveFocus()
      expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Water plants'])
    })

    it('changes details along with the title', async () => {
      startEditing('Wtaer plants')
      const form = screen.getByRole('form', { name: 'Edit "Wtaer plants"' })
      fireEvent.change(within(form).getByRole('combobox', { name: 'Priority' }), {
        target: { value: '2' },
      })
      await createCategoryIn(form, 'Home')
      // Creating the category must not end the edit; the form is still open.
      expect(form).toBeInTheDocument()
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(screen.getByRole('checkbox', { name: 'Wtaer plants' })).toHaveAccessibleDescription(
          'High priority, Home',
        ),
      )
    })

    it('saves when focus leaves the form', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Water plants' } })
      act(() => screen.getByRole('textbox', { name: 'New task' }).focus())

      expect(await screen.findByRole('checkbox', { name: 'Water plants' })).toBeInTheDocument()
    })

    it('does not save when focus moves between fields in the form', async () => {
      const input = startEditing('Wtaer plants')
      const form = screen.getByRole('form', { name: 'Edit "Wtaer plants"' })
      act(() => within(form).getByRole('combobox', { name: 'Priority' }).focus())

      // Give the deferred blur check its tick, then confirm we're still editing.
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(input).toBeInTheDocument()
    })

    it('cancels on Escape without saving', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Something else' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.getByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
      expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Wtaer plants'])
    })

    it('treats a cleared title as "keep the old one", not delete', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(input)

      expect(await screen.findByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('can be undone', async () => {
      const input = startEditing('Wtaer plants')
      fireEvent.change(input, { target: { value: 'Water plants' } })
      fireEvent.submit(input)
      await screen.findByRole('checkbox', { name: 'Water plants' })

      fireEvent.click(screen.getByRole('button', { name: /undo/i }))
      expect(await screen.findByRole('checkbox', { name: 'Wtaer plants' })).toBeInTheDocument()
    })
  })
})
