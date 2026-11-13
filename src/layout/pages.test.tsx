import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useUndoStore } from '../state/undoStore'
import { db } from '../storage/db'
import { createPage, deletePage, listPages, renamePage, restorePage } from '../storage/pages'
import { Hub } from './Hub'
import { initialLayoutState, useLayoutStore } from './layoutStore'
import { addRow } from './operations'

const store = () => useLayoutStore.getState()
const tabs = () => within(screen.getByRole('navigation', { name: 'Pages' }))
const currentTab = () => tabs().getByRole('button', { current: 'page' })

async function renderHub() {
  const result = render(<Hub />)
  await screen.findByRole('heading', { name: 'To-do' })
  return result
}

async function addPageNamed(name: string) {
  fireEvent.click(tabs().getByRole('button', { name: '+ New page' }))
  const input = screen.getByRole('textbox', { name: 'New page name' })
  fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(input)
  await waitFor(() => expect(currentTab()).toHaveTextContent(name))
}

describe('page storage', () => {
  it('creates, lists in order, renames, and refuses to delete the last page', async () => {
    const home = await createPage('Home', [])
    const school = await createPage('  School  ', [])
    expect(school.name).toBe('School')
    expect((await listPages()).map((p) => p.name)).toEqual(['Home', 'School'])

    await renamePage(school.id, 'Classes')
    await expect(renamePage(school.id, '  ')).rejects.toThrow('name')

    const removed = await deletePage(school.id)
    await expect(deletePage(home.id)).rejects.toThrow('only page')
    await restorePage(removed)
    expect((await listPages()).map((p) => p.name)).toEqual(['Home', 'Classes'])
  })
})

describe('pages in the hub', () => {
  it('starts with a Home tab', async () => {
    await renderHub()
    expect(currentTab()).toHaveTextContent('Home')
  })

  it('adds a page, opens it empty and in edit mode, and switches back', async () => {
    await renderHub()
    await addPageNamed('School')

    // A new page opens straight into editing, with one empty row.
    expect(screen.getByRole('button', { name: 'Done editing' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'To-do' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Row 1' })).toBeInTheDocument()

    fireEvent.click(tabs().getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'To-do' })).toBeInTheDocument()
    expect((await listPages()).map((p) => p.name)).toEqual(['Home', 'School'])
  })

  it('keeps each page’s layout and theme separate', async () => {
    await renderHub()
    await addPageNamed('Work')
    fireEvent.click(screen.getByRole('button', { name: 'Bullet journal' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('bujo'))

    fireEvent.click(tabs().getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('graph'))
    const pages = await listPages()
    expect(pages.map((p) => p.theme)).toEqual(['graph', 'bujo'])
  })

  it('renames the open page from its menu', async () => {
    await renderHub()
    fireEvent.click(tabs().getByRole('button', { name: 'Options for page "Home"' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Page name' })
    fireEvent.change(input, { target: { value: 'Everything' } })
    fireEvent.submit(input)

    await waitFor(() => expect(currentTab()).toHaveTextContent('Everything'))
    expect((await listPages())[0].name).toBe('Everything')
  })

  it("deletes a page, moves to another, and undo brings it back; the last page can't go", async () => {
    await renderHub()
    fireEvent.click(tabs().getByRole('button', { name: 'Options for page "Home"' }))
    expect(screen.getByRole('button', { name: 'Delete page' })).toBeDisabled()
    fireEvent.click(tabs().getByRole('button', { name: 'Options for page "Home"' }))

    await addPageNamed('Scratch')
    fireEvent.click(tabs().getByRole('button', { name: 'Options for page "Scratch"' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }))

    await waitFor(() => expect(currentTab()).toHaveTextContent('Home'))
    expect(tabs().queryByRole('button', { name: 'Scratch' })).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: /undo/i }))
    await waitFor(() => expect(currentTab()).toHaveTextContent('Scratch'))
  })

  it('reopens the page you were on after a refresh', async () => {
    const { unmount } = await renderHub()
    await addPageNamed('School')
    unmount()
    useLayoutStore.setState(initialLayoutState)

    render(<Hub />)
    await waitFor(() => expect(currentTab()).toHaveTextContent('School'))
  })
})

describe('undo across pages', () => {
  it('undoing a change from another page goes back to that page first', async () => {
    await store().ensureLoaded()
    const homeId = store().pageId!
    await store().commit('add row', addRow(store().rows))
    await store().addPage('Other')
    expect(store().pageId).not.toBe(homeId)

    // Undo "add page" (we're taken off the deleted page), then undo "add row" on Home.
    await useUndoStore.getState().undo()
    await useUndoStore.getState().undo()

    expect(store().pageId).toBe(homeId)
    expect(store().rows).toHaveLength(1)
    expect((await db.pages.get(homeId))?.rows).toHaveLength(1)
  })
})
