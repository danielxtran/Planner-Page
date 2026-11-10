import type { Category } from '../../storage/categories'
import { DEFAULT_PRIORITY, PRIORITIES, type Priority } from '../../storage/tasks'
import { PRIORITY_META } from './priority'
import type { DetailsDraft } from './TaskDetailsFields'
import {
  DEFAULT_FILTER,
  type DueFilter,
  type SortKey,
  type StatusFilter,
  type TaskFilter,
} from './taskFilter'

/** A to-do widget's saved settings, kept in the page layout as JSON. */
export interface TodoConfig {
  /** '' means the default heading. */
  title: string
  filter: TaskFilter
}

const STATUSES: readonly StatusFilter[] = ['all', 'open', 'done']
const DUES: readonly DueFilter[] = ['any', 'overdue', 'today', 'next7', 'none']
const SORTS: readonly SortKey[] = ['created', 'due', 'priority']

/**
 * Reads settings out of stored JSON. Anything missing or malformed falls back
 * to the default, field by field, so a layout saved by an older version (whose
 * to-do widgets had `{}`) or a hand-edited backup still loads.
 */
export function readTodoConfig(config: Record<string, unknown>): TodoConfig {
  const raw = isObject(config.filter) ? config.filter : {}
  const filter: TaskFilter = {
    status: oneOf(raw.status, STATUSES, DEFAULT_FILTER.status),
    priorities: Array.isArray(raw.priorities)
      ? raw.priorities.filter((p): p is Priority => PRIORITIES.includes(p as Priority))
      : [],
    categoryIds: Array.isArray(raw.categoryIds)
      ? raw.categoryIds.filter((id): id is string | null => id === null || typeof id === 'string')
      : [],
    due: oneOf(raw.due, DUES, DEFAULT_FILTER.due),
    sort: oneOf(raw.sort, SORTS, DEFAULT_FILTER.sort),
  }
  return { title: typeof config.title === 'string' ? config.title : '', filter }
}

const DUE_WORDS: Record<DueFilter, string | null> = {
  any: null,
  overdue: 'Overdue',
  today: 'Due today',
  next7: 'Next 7 days',
  none: 'No due date',
}

/** A readable name for a filter, e.g. "School · Top · Next 7 days", used to title a saved widget. */
export function describeFilter(filter: TaskFilter, categories: Category[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const parts = [
    filter.categoryIds
      .map((id) => (id === null ? 'No category' : names.get(id)))
      .filter(Boolean)
      .join(' + '),
    // Sorted so "Top + High" reads the same whichever chip was clicked first.
    [...filter.priorities]
      .sort()
      .map((p) => PRIORITY_META[p].label)
      .join(' + '),
    DUE_WORDS[filter.due],
    filter.status === 'open' ? 'To do' : filter.status === 'done' ? 'Done' : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'All tasks'
}

/**
 * Starting values for quick-add in a filtered widget, so a task added to a
 * "School" widget is a School task and stays visible there. Only filters with
 * exactly one obvious answer fill anything in.
 */
export function draftDefaultsFor(filter: TaskFilter, today: string): DetailsDraft {
  const [onlyCategory] = filter.categoryIds
  const [onlyPriority] = filter.priorities
  return {
    priority: filter.priorities.length === 1 ? onlyPriority : DEFAULT_PRIORITY,
    categoryId: filter.categoryIds.length === 1 ? onlyCategory : null,
    // "Next 7 days" includes today, so today is a safe pick for both.
    dueDate: filter.due === 'today' || filter.due === 'next7' ? today : null,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}
