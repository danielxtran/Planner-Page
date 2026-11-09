import { describe, expect, it } from 'vitest'
import type { Task } from '../../storage/tasks'
import { applyFilter, countActiveFilters, DEFAULT_FILTER, type TaskFilter } from './taskFilter'

const TODAY = '2026-11-09'
let counter = 0

function task(overrides: Partial<Task>): Task {
  counter++
  return {
    id: `t${counter}`,
    userId: 'local-user',
    title: `Task ${counter}`,
    done: false,
    priority: 4,
    categoryId: null,
    dueDate: null,
    createdAt: `2026-11-01T09:00:${String(counter).padStart(2, '0')}.000Z`,
    updatedAt: '2026-11-01T09:00:00.000Z',
    ...overrides,
  }
}

function titles(tasks: Task[], filter: Partial<TaskFilter>) {
  return applyFilter(tasks, { ...DEFAULT_FILTER, ...filter }, TODAY).map((t) => t.title)
}

describe('applyFilter', () => {
  it('returns everything in creation order with the default filter', () => {
    const tasks = [
      task({ title: 'B', createdAt: '2026-11-02' }),
      task({ title: 'A', createdAt: '2026-11-01' }),
    ]
    expect(titles(tasks, {})).toEqual(['A', 'B'])
  })

  it('does not modify the input array', () => {
    const tasks = [
      task({ title: 'B', createdAt: '2026-11-02' }),
      task({ title: 'A', createdAt: '2026-11-01' }),
    ]
    applyFilter(tasks, DEFAULT_FILTER, TODAY)
    expect(tasks.map((t) => t.title)).toEqual(['B', 'A'])
  })

  it('filters by status', () => {
    const tasks = [task({ title: 'Open' }), task({ title: 'Done', done: true })]
    expect(titles(tasks, { status: 'open' })).toEqual(['Open'])
    expect(titles(tasks, { status: 'done' })).toEqual(['Done'])
  })

  it('filters by any of several priorities', () => {
    const tasks = [1, 2, 3, 4].map((p) => task({ title: `P${p}`, priority: p as Task['priority'] }))
    expect(titles(tasks, { priorities: [1, 3] })).toEqual(['P1', 'P3'])
  })

  it('filters by category, with null meaning uncategorized', () => {
    const tasks = [
      task({ title: 'School', categoryId: 'school' }),
      task({ title: 'Home', categoryId: 'home' }),
      task({ title: 'None', categoryId: null }),
    ]
    expect(titles(tasks, { categoryIds: ['school'] })).toEqual(['School'])
    expect(titles(tasks, { categoryIds: ['home', null] })).toEqual(['Home', 'None'])
  })

  describe('due filter', () => {
    const tasks = [
      task({ title: 'Last week', dueDate: '2026-11-02' }),
      task({ title: 'Yesterday, done', dueDate: '2026-11-08', done: true }),
      task({ title: 'Today', dueDate: '2026-11-09' }),
      task({ title: 'In 6 days', dueDate: '2026-11-15' }),
      task({ title: 'In 7 days', dueDate: '2026-11-16' }),
      task({ title: 'No date' }),
    ]

    it('overdue: past due and not done', () => {
      expect(titles(tasks, { due: 'overdue' })).toEqual(['Last week'])
    })
    it('today', () => {
      expect(titles(tasks, { due: 'today' })).toEqual(['Today'])
    })
    it('next 7 days: today through 6 days from now', () => {
      expect(titles(tasks, { due: 'next7' })).toEqual(['Today', 'In 6 days'])
    })
    it('no date', () => {
      expect(titles(tasks, { due: 'none' })).toEqual(['No date'])
    })
  })

  it('combines filters with AND', () => {
    const tasks = [
      task({ title: 'Match', priority: 1, categoryId: 'work', dueDate: TODAY }),
      task({ title: 'Wrong priority', priority: 2, categoryId: 'work', dueDate: TODAY }),
      task({ title: 'Wrong category', priority: 1, categoryId: 'home', dueDate: TODAY }),
      task({ title: 'Done', priority: 1, categoryId: 'work', dueDate: TODAY, done: true }),
    ]
    expect(
      titles(tasks, { status: 'open', priorities: [1], categoryIds: ['work'], due: 'today' }),
    ).toEqual(['Match'])
  })

  describe('sorting', () => {
    const tasks = [
      task({ title: 'P3 no date', priority: 3 }),
      task({ title: 'P4 tomorrow', priority: 4, dueDate: '2026-11-10' }),
      task({ title: 'P1 next week', priority: 1, dueDate: '2026-11-16' }),
      task({ title: 'P2 tomorrow', priority: 2, dueDate: '2026-11-10' }),
      task({ title: 'P1 no date', priority: 1 }),
    ]

    it('by due date: soonest first, ties by priority, no date last', () => {
      expect(titles(tasks, { sort: 'due' })).toEqual([
        'P2 tomorrow',
        'P4 tomorrow',
        'P1 next week',
        'P1 no date',
        'P3 no date',
      ])
    })

    it('by priority: most urgent first, ties by due date', () => {
      expect(titles(tasks, { sort: 'priority' })).toEqual([
        'P1 next week',
        'P1 no date',
        'P2 tomorrow',
        'P3 no date',
        'P4 tomorrow',
      ])
    })
  })
})

describe('countActiveFilters', () => {
  it('counts narrowing groups but not sort order', () => {
    expect(countActiveFilters(DEFAULT_FILTER)).toBe(0)
    expect(countActiveFilters({ ...DEFAULT_FILTER, sort: 'due' })).toBe(0)
    expect(
      countActiveFilters({ ...DEFAULT_FILTER, status: 'open', priorities: [1, 2], due: 'today' }),
    ).toBe(3)
  })
})

it('a filter survives a JSON round trip unchanged', () => {
  const filter: TaskFilter = {
    status: 'open',
    priorities: [1],
    categoryIds: ['a', null],
    due: 'next7',
    sort: 'priority',
  }
  expect(JSON.parse(JSON.stringify(filter))).toEqual(filter)
})
