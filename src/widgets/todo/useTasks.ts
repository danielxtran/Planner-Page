import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addCategory,
  listCategories,
  removeCategory,
  sameName,
  type Category,
} from '../../storage/categories'
import {
  addTask,
  listTasks,
  removeTask,
  restoreTask,
  updateTask,
  type Task,
  type TaskChanges,
  type TaskDetails,
} from '../../storage/tasks'

interface UndoEntry {
  label: string
  undo: () => Promise<unknown>
}

/** What a storage action hands back to `run`: its result plus how to reverse it. */
interface Step<T> extends UndoEntry {
  value: T
}

const MAX_UNDO = 50

/**
 * Task and category state for the to-do widget. Every action saves immediately
 * through the storage modules, then records how to reverse itself on an undo stack.
 *
 * The undo stack lives here for now; once there are several widgets it should
 * move to a shared store so one Ctrl+Z covers the whole hub.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The stack is a ref (always current inside async code); the label is state
  // so the Undo button re-renders when it changes.
  const undoStack = useRef<UndoEntry[]>([])
  const [undoLabel, setUndoLabel] = useState<string | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listTasks(), listCategories()])
      .then(([loadedTasks, loadedCategories]) => {
        if (cancelled) return
        setTasks(loadedTasks)
        setCategories(loadedCategories)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(messageOf(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    const [loadedTasks, loadedCategories] = await Promise.all([listTasks(), listCategories()])
    setTasks(loadedTasks)
    setCategories(loadedCategories)
  }, [])

  const syncUndoLabel = () => setUndoLabel(undoStack.current.at(-1)?.label ?? null)

  /**
   * Runs one storage action, records its undo, and reloads.
   * Resolves to the action's value, or undefined if it failed (the error is shown).
   */
  const run = useCallback(
    async <T>(action: () => Promise<Step<T>>): Promise<T | undefined> => {
      setError(null)
      try {
        const { value, label, undo } = await action()
        undoStack.current = [...undoStack.current, { label, undo }].slice(-MAX_UNDO)
        syncUndoLabel()
        await reload()
        return value
      } catch (e) {
        setError(messageOf(e))
        return undefined
      }
    },
    [reload],
  )

  const add = useCallback(
    (title: string, details: TaskDetails = {}) =>
      run(async () => {
        const task = await addTask(title, details)
        return { value: task, label: `add "${task.title}"`, undo: () => removeTask(task.id) }
      }),
    [run],
  )

  const toggle = useCallback(
    (task: Task) =>
      run(async () => {
        await updateTask(task.id, { done: !task.done })
        return {
          value: true,
          label: `${task.done ? 'uncheck' : 'check'} "${task.title}"`,
          undo: () => updateTask(task.id, { done: task.done }),
        }
      }),
    [run],
  )

  /** Saves only the fields that actually changed, so undo restores exactly those. */
  const edit = useCallback(
    async (task: Task, changes: TaskChanges) => {
      const wanted: TaskChanges =
        changes.title === undefined ? changes : { ...changes, title: changes.title.trim() }
      const keys = (Object.keys(wanted) as (keyof TaskChanges)[]).filter(
        (key) => wanted[key] !== undefined && wanted[key] !== task[key],
      )
      // No real change, so nothing to save and nothing worth an undo step.
      if (keys.length === 0) return true

      const next = Object.fromEntries(keys.map((key) => [key, wanted[key]])) as TaskChanges
      const previous = Object.fromEntries(keys.map((key) => [key, task[key]])) as TaskChanges
      const label =
        keys.length === 1 && keys[0] === 'title'
          ? `rename "${task.title}" to "${next.title}"`
          : `edit "${task.title}"`

      const saved = await run(async () => {
        await updateTask(task.id, next)
        return { value: true, label, undo: () => updateTask(task.id, previous) }
      })
      return saved ?? false
    },
    [run],
  )

  const remove = useCallback(
    (task: Task) =>
      run(async () => {
        const removed = await removeTask(task.id)
        return { value: true, label: `delete "${task.title}"`, undo: () => restoreTask(removed) }
      }),
    [run],
  )

  /** Creates a category, or returns the existing one if the name is already taken. */
  const createCategory = useCallback(
    async (name: string) => {
      const existing = categories.find((c) => sameName(c.name, name))
      if (existing) return existing
      return run(async () => {
        const category = await addCategory(name)
        return {
          value: category,
          label: `create category "${category.name}"`,
          undo: () => removeCategory(category.id),
        }
      })
    },
    [categories, run],
  )

  const undo = useCallback(async () => {
    const entry = undoStack.current.at(-1)
    // `busy` stops a fast double Ctrl+Z from running the same entry twice.
    if (!entry || busy.current) return
    busy.current = true
    undoStack.current = undoStack.current.slice(0, -1)
    syncUndoLabel()
    setError(null)
    try {
      await entry.undo()
      await reload()
    } catch (e) {
      setError(`Couldn't undo: ${messageOf(e)}`)
    } finally {
      busy.current = false
    }
  }, [reload])

  return {
    tasks,
    categories,
    loading,
    error,
    add,
    toggle,
    edit,
    remove,
    createCategory,
    undo,
    undoLabel,
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
