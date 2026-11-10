import { describe, expect, it } from 'vitest'
import type { Category } from '../../storage/categories'
import { DEFAULT_FILTER, type TaskFilter } from './taskFilter'
import { describeFilter, draftDefaultsFor, readTodoConfig } from './todoConfig'

const category = (id: string, name: string): Category => ({
  id,
  name,
  color: 'mint',
  userId: 'local-user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const school = category('c-school', 'School')
const work = category('c-work', 'Work')
const filter = (changes: Partial<TaskFilter>): TaskFilter => ({ ...DEFAULT_FILTER, ...changes })

describe('readTodoConfig', () => {
  it('gives defaults for an empty config (widgets saved before milestone 4)', () => {
    expect(readTodoConfig({})).toEqual({ title: '', filter: DEFAULT_FILTER })
  })

  it('reads a saved title and filter', () => {
    const saved = { title: 'School', filter: filter({ categoryIds: ['c-school'], due: 'next7' }) }
    expect(readTodoConfig(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('replaces bad fields one by one and keeps the good ones', () => {
    const config = readTodoConfig({
      title: 42,
      filter: { status: 'open', priorities: [1, 9, 'x'], categoryIds: ['a', 3, null], due: 'soon' },
    })
    expect(config).toEqual({
      title: '',
      filter: { ...DEFAULT_FILTER, status: 'open', priorities: [1], categoryIds: ['a', null] },
    })
  })
})

describe('describeFilter', () => {
  it('names categories, priorities, due date, and status in a fixed order', () => {
    const f = filter({
      categoryIds: ['c-school'],
      priorities: [2, 1],
      due: 'next7',
      status: 'open',
    })
    expect(describeFilter(f, [school, work])).toBe('School · Top + High · Next 7 days · To do')
  })

  it('joins several categories and handles "no category"', () => {
    const f = filter({ categoryIds: ['c-work', null] })
    expect(describeFilter(f, [school, work])).toBe('Work + No category')
  })

  it('falls back to "All tasks" when nothing narrows the list', () => {
    expect(describeFilter(filter({ sort: 'due' }), [])).toBe('All tasks')
  })
})

describe('draftDefaultsFor', () => {
  it('fills in a single category, a single priority, and today for date filters', () => {
    const f = filter({ categoryIds: ['c-school'], priorities: [1], due: 'next7' })
    expect(draftDefaultsFor(f, '2026-03-02')).toEqual({
      priority: 1,
      categoryId: 'c-school',
      dueDate: '2026-03-02',
    })
  })

  it('leaves fields alone when the filter allows several answers', () => {
    const f = filter({ categoryIds: ['c-school', 'c-work'], priorities: [1, 2], due: 'overdue' })
    expect(draftDefaultsFor(f, '2026-03-02')).toEqual({
      priority: 4,
      categoryId: null,
      dueDate: null,
    })
  })
})
