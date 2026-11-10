import { Dexie } from 'dexie'
import { expect, it } from 'vitest'
import { db } from './db'

it('upgrades v1 tasks to v2 by filling in the new fields', async () => {
  // Start from scratch, then build the database exactly as milestone 1 left it.
  await db.delete()
  const v1 = new Dexie('planner-hub')
  v1.version(1).stores({ tasks: 'id, userId, createdAt' })
  const oldTask = {
    id: 'old-task',
    userId: 'local-user',
    title: 'Written before milestone 2',
    done: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  }
  await v1.table('tasks').add(oldTask)
  v1.close()

  // Opening the app's database runs the v2 upgrade.
  await db.open()

  expect(await db.tasks.get('old-task')).toEqual({
    ...oldTask,
    priority: 4,
    categoryId: null,
    dueDate: null,
  })
  expect(await db.categories.count()).toBe(0)
})

it('upgrades v3 pages to v4 by giving them the graph-paper theme', async () => {
  await db.delete()
  // The database as milestone 3 left it: versions 1-3, a page with no theme.
  const v3 = new Dexie('planner-hub')
  v3.version(1).stores({ tasks: 'id, userId, createdAt' })
  v3.version(2).stores({
    tasks: 'id, userId, createdAt, categoryId',
    categories: 'id, userId, createdAt',
  })
  v3.version(3).stores({ pages: 'id, userId, createdAt' })
  const oldPage = {
    id: 'old-page',
    userId: 'local-user',
    name: 'Home',
    rows: [],
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  }
  await v3.table('pages').add(oldPage)
  v3.close()

  await db.open()

  expect(await db.pages.get('old-page')).toEqual({ ...oldPage, theme: 'graph' })
  expect(await db.notes.count()).toBe(0)
})
