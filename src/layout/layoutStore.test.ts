import { describe, expect, it } from 'vitest'
import { useErrorStore } from '../state/errorStore'
import { useUndoStore } from '../state/undoStore'
import { db } from '../storage/db'
import type { Row } from '../storage/pages'
import { useLayoutStore } from './layoutStore'
import { addRow } from './operations'

const store = () => useLayoutStore.getState()

describe('layoutStore', () => {
  it('loads a default page with one to-do widget, and only once', async () => {
    await Promise.all([store().ensureLoaded(), store().ensureLoaded()])

    expect(store().status).toBe('ready')
    expect(store().rows).toHaveLength(1)
    expect(store().rows[0].columns[0].widgets.map((w) => w.type)).toEqual(['todo'])
    expect(await db.pages.count()).toBe(1)
  })

  it('commits: shows, saves, and records an undo step that restores the old layout', async () => {
    await store().ensureLoaded()
    const before = store().rows
    const next = addRow(before)

    await store().commit('add row', next)

    expect(store().rows).toBe(next)
    expect((await db.pages.toArray())[0].rows).toEqual(next)
    expect(useUndoStore.getState().entries.map((e) => e.label)).toEqual(['add row'])

    await useUndoStore.getState().undo()
    expect(store().rows).toEqual(before)
    expect((await db.pages.toArray())[0].rows).toEqual(before)
  })

  it('skips a commit that changes nothing', async () => {
    await store().ensureLoaded()
    await store().commit('nothing', store().rows)
    expect(useUndoStore.getState().entries).toEqual([])
  })

  it('reverts and reports when a save fails', async () => {
    await store().ensureLoaded()
    const before = store().rows
    const broken: Row[] = [{ id: 'r', columns: [{ id: 'c', width: 5, widgets: [] }] }]

    await store().commit('break it', broken)

    expect(store().rows).toBe(before)
    expect(useErrorStore.getState().message).toMatch(/Couldn't save the layout/)
    expect(useUndoStore.getState().entries).toEqual([])
  })
})
