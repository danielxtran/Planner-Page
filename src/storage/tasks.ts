import { db } from './db'
import { LOCAL_USER_ID } from './user'

/** 1 = most urgent, 4 = lowest. */
export type Priority = 1 | 2 | 3 | 4
export const PRIORITIES: readonly Priority[] = [1, 2, 3, 4]
/** New tasks start at the lowest priority, so only the ones you flag stand out. */
export const DEFAULT_PRIORITY: Priority = 4

export interface Task {
  id: string
  userId: string
  title: string
  done: boolean
  priority: Priority
  /** At most one category; null means uncategorized. */
  categoryId: string | null
  /**
   * A calendar date as 'yyyy-MM-dd', or null. Deliberately no time or time
   * zone: "due Friday" should stay Friday wherever and whenever you look.
   */
  dueDate: string | null
  /** ISO 8601 timestamps: sortable as strings and readable in JSON backups. */
  createdAt: string
  updatedAt: string
}

export type TaskDetails = Partial<Pick<Task, 'priority' | 'categoryId' | 'dueDate'>>
export type TaskChanges = Partial<Pick<Task, 'title' | 'done'>> & TaskDetails

/** All of the current user's tasks, oldest first. */
export async function listTasks(): Promise<Task[]> {
  return db.tasks.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt')
}

export async function addTask(title: string, details: TaskDetails = {}): Promise<Task> {
  const now = new Date().toISOString()
  const task: Task = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER_ID,
    title: cleanTitle(title),
    done: false,
    priority: details.priority ?? DEFAULT_PRIORITY,
    categoryId: details.categoryId ?? null,
    dueDate: details.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
  }
  validateDetails(task)

  await db.transaction('rw', db.tasks, db.categories, async () => {
    await assertCategoryExists(task.categoryId)
    await db.tasks.add(task)
  })
  return task
}

export async function updateTask(id: string, changes: TaskChanges): Promise<Task> {
  // Drop keys set to undefined so they can't blank out stored fields when spread.
  const cleaned: TaskChanges = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  )
  if (cleaned.title !== undefined) cleaned.title = cleanTitle(cleaned.title)
  validateDetails(cleaned)

  // A transaction makes the read-then-write atomic, so two quick edits can't
  // interleave and lose one of the changes.
  return db.transaction('rw', db.tasks, db.categories, async () => {
    const existing = await getOwnTask(id)
    if (cleaned.categoryId !== undefined) await assertCategoryExists(cleaned.categoryId)
    const updated: Task = { ...existing, ...cleaned, updatedAt: new Date().toISOString() }
    await db.tasks.put(updated)
    return updated
  })
}

/** Deletes a task and returns it, so the caller can offer undo via restoreTask. */
export async function removeTask(id: string): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const existing = await getOwnTask(id)
    await db.tasks.delete(id)
    return existing
  })
}

/**
 * Puts a previously removed task back exactly as it was (same id and timestamps).
 * If its category has been deleted in the meantime, it comes back uncategorized.
 */
export async function restoreTask(task: Task): Promise<void> {
  await db.transaction('rw', db.tasks, db.categories, async () => {
    const categoryGone = task.categoryId !== null && !(await db.categories.get(task.categoryId))
    await db.tasks.put(categoryGone ? { ...task, categoryId: null } : task)
  })
}

function cleanTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Task title cannot be empty')
  return trimmed
}

function validateDetails(details: TaskDetails) {
  if (details.priority !== undefined && !PRIORITIES.includes(details.priority)) {
    throw new Error(`Priority must be 1-4, got ${details.priority}`)
  }
  if (details.dueDate != null && !isCalendarDate(details.dueDate)) {
    throw new Error(`Due date must be a real yyyy-MM-dd date, got ${details.dueDate}`)
  }
}

/** True for real dates like 2026-02-28; false for 2026-02-30 or 'tomorrow'. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

async function assertCategoryExists(categoryId: string | null) {
  if (categoryId === null) return
  const category = await db.categories.get(categoryId)
  if (!category || category.userId !== LOCAL_USER_ID) {
    throw new Error(`Category not found: ${categoryId}`)
  }
}

async function getOwnTask(id: string): Promise<Task> {
  const task = await db.tasks.get(id)
  if (!task || task.userId !== LOCAL_USER_ID) throw new Error(`Task not found: ${id}`)
  return task
}
