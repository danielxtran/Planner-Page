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
