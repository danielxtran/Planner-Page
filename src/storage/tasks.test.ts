import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addCategory, removeCategory } from './categories'
import { db } from './db'
import { addTask, listTasks, removeTask, restoreTask, updateTask, type Priority } from './tasks'
import { LOCAL_USER_ID } from './user'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

beforeEach(async () => {
  await Promise.all([db.tasks.clear(), db.categories.clear()])
  // Fake only Date: faking timers too would stall fake-indexeddb, which uses them internally.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('addTask', () => {
  it('creates a task with all required fields and default details', async () => {
    const task = await addTask('Buy stickers')

    expect(task).toEqual({
      id: expect.stringMatching(UUID),
      userId: LOCAL_USER_ID,
      title: 'Buy stickers',
      done: false,
      priority: 4,
      categoryId: null,
      dueDate: null,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    })
    expect(await db.tasks.get(task.id)).toEqual(task)
  })

  it('saves priority, category, and due date when given', async () => {
    const school = await addCategory('School')
    const task = await addTask('Essay', {
      priority: 1,
      categoryId: school.id,
      dueDate: '2026-01-05',
    })

    expect(task).toMatchObject({ priority: 1, categoryId: school.id, dueDate: '2026-01-05' })
    expect(await db.tasks.get(task.id)).toEqual(task)
  })

  it('trims the title', async () => {
    const task = await addTask('   Water plants  ')
    expect(task.title).toBe('Water plants')
  })

  it('rejects empty or whitespace-only titles and saves nothing', async () => {
    await expect(addTask('')).rejects.toThrow('empty')
    await expect(addTask('   ')).rejects.toThrow('empty')
    expect(await db.tasks.count()).toBe(0)
  })

  it.each([0, 5, 2.5])('rejects priority %s', async (priority) => {
    await expect(addTask('Bad', { priority: priority as Priority })).rejects.toThrow('Priority')
    expect(await db.tasks.count()).toBe(0)
  })

  it.each(['2026-02-30', '2026-13-01', '26-01-01', 'tomorrow', '2026-01-01T10:00'])(
    'rejects due date %s',
    async (dueDate) => {
      await expect(addTask('Bad', { dueDate })).rejects.toThrow('Due date')
    },
  )

  it('accepts a leap day', async () => {
    const task = await addTask('Leap', { dueDate: '2028-02-29' })
    expect(task.dueDate).toBe('2028-02-29')
  })

  it('rejects an unknown category and saves nothing', async () => {
    await expect(addTask('Orphan', { categoryId: 'nope' })).rejects.toThrow('Category not found')
    expect(await db.tasks.count()).toBe(0)
  })

  it('gives each task a unique id', async () => {
    const a = await addTask('A')
    const b = await addTask('B')
    expect(a.id).not.toBe(b.id)
  })
})

describe('listTasks', () => {
  it('returns an empty list when there are no tasks', async () => {
    expect(await listTasks()).toEqual([])
  })

  it('returns tasks oldest first', async () => {
    await addTask('First')
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    await addTask('Second')
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'))
    await addTask('Earliest')

    expect((await listTasks()).map((t) => t.title)).toEqual(['Earliest', 'First', 'Second'])
  })

  it("excludes other users' tasks", async () => {
    await addTask('Mine')
    await db.tasks.add({
      id: crypto.randomUUID(),
      userId: 'someone-else',
      title: 'Not mine',
      done: false,
      priority: 4,
      categoryId: null,
      dueDate: null,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    })

    expect((await listTasks()).map((t) => t.title)).toEqual(['Mine'])
  })
})

describe('updateTask', () => {
  it('updates done and bumps updatedAt but not createdAt', async () => {
    const task = await addTask('Journal')
    vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z'))

    const updated = await updateTask(task.id, { done: true })

    expect(updated).toEqual({ ...task, done: true, updatedAt: '2026-01-02T12:00:00.000Z' })
    expect(await db.tasks.get(task.id)).toEqual(updated)
  })

  it('updates and trims the title', async () => {
    const task = await addTask('Old')
    const updated = await updateTask(task.id, { title: '  New  ' })
    expect(updated.title).toBe('New')
  })

  it('updates details and can clear category and due date back to null', async () => {
    const home = await addCategory('Home')
    const task = await addTask('Laundry')

    const set = await updateTask(task.id, {
      priority: 2,
      categoryId: home.id,
      dueDate: '2026-01-03',
    })
    expect(set).toMatchObject({ priority: 2, categoryId: home.id, dueDate: '2026-01-03' })

    const cleared = await updateTask(task.id, { categoryId: null, dueDate: null })
    expect(cleared).toMatchObject({ priority: 2, categoryId: null, dueDate: null })
  })

  it('ignores keys explicitly set to undefined', async () => {
    const task = await addTask('Keep title', { dueDate: '2026-01-03' })
    const updated = await updateTask(task.id, { title: undefined, dueDate: undefined, done: true })
    expect(updated).toMatchObject({ title: 'Keep title', dueDate: '2026-01-03', done: true })
  })

  it('rejects invalid details and leaves the task unchanged', async () => {
    const task = await addTask('Keep me')
    await expect(updateTask(task.id, { title: '  ' })).rejects.toThrow('empty')
    await expect(updateTask(task.id, { priority: 9 as Priority })).rejects.toThrow('Priority')
    await expect(updateTask(task.id, { dueDate: '2026-04-31' })).rejects.toThrow('Due date')
    await expect(updateTask(task.id, { categoryId: 'nope' })).rejects.toThrow('Category not found')
    expect(await db.tasks.get(task.id)).toEqual(task)
  })

  it('throws for a missing task', async () => {
    await expect(updateTask('nope', { done: true })).rejects.toThrow('not found')
  })
})

describe('removeTask', () => {
  it('deletes the task and returns it', async () => {
    const keep = await addTask('Keep')
    const drop = await addTask('Drop')

    expect(await removeTask(drop.id)).toEqual(drop)
    expect(await listTasks()).toEqual([keep])
  })

  it('throws for a missing task', async () => {
    await expect(removeTask('nope')).rejects.toThrow('not found')
  })
})

describe('restoreTask', () => {
  it('brings a removed task back with its original id and timestamps', async () => {
    const task = await addTask('Oops')
    const removed = await removeTask(task.id)

    await restoreTask(removed)

    expect(await listTasks()).toEqual([task])
  })

  it('restores as uncategorized if its category was deleted meanwhile', async () => {
    const gym = await addCategory('Gym')
    const task = await addTask('Leg day', { categoryId: gym.id })
    const removed = await removeTask(task.id)
    await removeCategory(gym.id)

    await restoreTask(removed)

    expect(await listTasks()).toEqual([{ ...task, categoryId: null }])
  })
})
