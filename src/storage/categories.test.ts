import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addCategory, CATEGORY_COLORS, listCategories, removeCategory } from './categories'
import { db } from './db'
import { addTask } from './tasks'
import { LOCAL_USER_ID } from './user'

beforeEach(async () => {
  await Promise.all([db.tasks.clear(), db.categories.clear()])
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('addCategory', () => {
  it('creates a category with all required fields', async () => {
    const category = await addCategory('  School ')

    expect(category).toEqual({
      id: expect.any(String),
      userId: LOCAL_USER_ID,
      name: 'School',
      color: 'peach',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    })
    expect(await db.categories.get(category.id)).toEqual(category)
  })

  it('cycles through the palette for each new category', async () => {
    const colors = []
    for (let i = 0; i < CATEGORY_COLORS.length + 1; i++) {
      colors.push((await addCategory(`Category ${i}`)).color)
    }
    expect(colors).toEqual([...CATEGORY_COLORS, CATEGORY_COLORS[0]])
  })

  it('rejects an empty name', async () => {
    await expect(addCategory('  ')).rejects.toThrow('empty')
  })

  it('rejects a duplicate name, ignoring case and spaces', async () => {
    await addCategory('Work')
    await expect(addCategory(' work ')).rejects.toThrow('already exists')
    expect(await db.categories.count()).toBe(1)
  })
})

describe('listCategories', () => {
  it('returns categories oldest first', async () => {
    await addCategory('B')
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'))
    await addCategory('A')

    expect((await listCategories()).map((c) => c.name)).toEqual(['A', 'B'])
  })
})

describe('removeCategory', () => {
  it('deletes the category and uncategorizes only its tasks', async () => {
    const work = await addCategory('Work')
    const home = await addCategory('Home')
    const report = await addTask('Report', { categoryId: work.id })
    const dishes = await addTask('Dishes', { categoryId: home.id })
    vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'))

    expect(await removeCategory(work.id)).toEqual(work)

    expect(await listCategories()).toEqual([home])
    expect(await db.tasks.get(report.id)).toEqual({
      ...report,
      categoryId: null,
      updatedAt: '2026-01-02T09:00:00.000Z',
    })
    expect(await db.tasks.get(dishes.id)).toEqual(dishes)
  })

  it('throws for a missing category', async () => {
    await expect(removeCategory('nope')).rejects.toThrow('not found')
  })
})
