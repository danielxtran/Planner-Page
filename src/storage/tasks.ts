import { db } from './db'
import { LOCAL_USER_ID } from './user'

export interface Task {
  id: string
  userId: string
  title: string
  done: boolean
  /** ISO 8601 timestamps: sortable as strings and readable in JSON backups. */
  createdAt: string
  updatedAt: string
}

export type TaskChanges = Partial<Pick<Task, 'title' | 'done'>>

/** All of the current user's tasks, oldest first. */
export async function listTasks(): Promise<Task[]> {
  return db.tasks.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt')
}

export async function addTask(title: string): Promise<Task> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Task title cannot be empty')

  const now = new Date().toISOString()
  const task: Task = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER_ID,
    title: trimmed,
    done: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: string, changes: TaskChanges): Promise<Task> {
  if (changes.title !== undefined) {
    const trimmed = changes.title.trim()
    if (!trimmed) throw new Error('Task title cannot be empty')
    changes = { ...changes, title: trimmed }
  }

  // A transaction makes the read-then-write atomic, so two quick edits can't
  // interleave and lose one of the changes.
  return db.transaction('rw', db.tasks, async () => {
    const existing = await getOwnTask(id)
    const updated: Task = { ...existing, ...changes, updatedAt: new Date().toISOString() }
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

/** Puts a previously removed task back exactly as it was (same id and timestamps). */
export async function restoreTask(task: Task): Promise<void> {
  await db.tasks.put(task)
}

async function getOwnTask(id: string): Promise<Task> {
  const task = await db.tasks.get(id)
  if (!task || task.userId !== LOCAL_USER_ID) throw new Error(`Task not found: ${id}`)
  return task
}
