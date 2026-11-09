import type { Priority, Task } from '../../storage/tasks'
import { addDaysTo } from './dates'

export type StatusFilter = 'all' | 'open' | 'done'
export type DueFilter = 'any' | 'overdue' | 'today' | 'next7' | 'none'
export type SortKey = 'created' | 'due' | 'priority'

/**
 * A view over the task list. Kept as plain JSON on purpose: milestone 4 saves
 * these as widgets, so a filter must survive JSON.stringify/parse unchanged.
 */
export interface TaskFilter {
  status: StatusFilter
  /** Empty means every priority. */
  priorities: Priority[]
  /** Empty means every category; null in the list means "no category". */
  categoryIds: (string | null)[]
  due: DueFilter
  sort: SortKey
}

export const DEFAULT_FILTER: TaskFilter = {
  status: 'all',
  priorities: [],
  categoryIds: [],
  due: 'any',
  sort: 'created',
}

/** How many filter groups are narrowing the list. Sort order doesn't count. */
export function countActiveFilters(filter: TaskFilter): number {
  return [
    filter.status !== 'all',
    filter.priorities.length > 0,
    filter.categoryIds.length > 0,
    filter.due !== 'any',
  ].filter(Boolean).length
}

/** `today` is a 'yyyy-MM-dd' string, passed in so results don't depend on the clock. */
export function matchesFilter(task: Task, filter: TaskFilter, today: string): boolean {
  if (filter.status === 'open' && task.done) return false
  if (filter.status === 'done' && !task.done) return false
  if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false
  if (filter.categoryIds.length > 0 && !filter.categoryIds.includes(task.categoryId)) return false

  // 'yyyy-MM-dd' strings compare correctly as plain text, so no Date parsing here.
  const due = task.dueDate
  switch (filter.due) {
    case 'any':
      return true
    case 'overdue':
      return due !== null && due < today && !task.done
    case 'today':
      return due === today
    case 'next7':
      return due !== null && due >= today && due <= addDaysTo(today, 6)
    case 'none':
      return due === null
  }
}

/** Filters, then sorts into a new array; the input is not modified. */
export function applyFilter(tasks: Task[], filter: TaskFilter, today: string): Task[] {
  return tasks.filter((t) => matchesFilter(t, filter, today)).sort(comparators[filter.sort])
}

type Compare = (a: Task, b: Task) => number

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byCreated: Compare = (a, b) => compareText(a.createdAt, b.createdAt)
const byPriority: Compare = (a, b) => a.priority - b.priority
// Tasks with no due date go last; they're the least time-sensitive.
const byDue: Compare = (a, b) => {
  if (a.dueDate === b.dueDate) return 0
  if (a.dueDate === null) return 1
  if (b.dueDate === null) return -1
  return compareText(a.dueDate, b.dueDate)
}

const comparators: Record<SortKey, Compare> = {
  created: byCreated,
  due: (a, b) => byDue(a, b) || byPriority(a, b) || byCreated(a, b),
  priority: (a, b) => byPriority(a, b) || byDue(a, b) || byCreated(a, b),
}
