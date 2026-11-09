import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addTask,
  listTasks,
  removeTask,
  restoreTask,
  updateTask,
  type Task,
} from '../../storage/tasks'

interface UndoEntry {
  label: string
  undo: () => Promise<unknown>
}

const MAX_UNDO = 50

/**
 * Task state for the to-do widget. Every action saves immediately through the
 * storage module, then records how to reverse itself on an undo stack.
 *
 * The undo stack lives here for now; once there are several widgets it should
 * move to a shared store so one Ctrl+Z covers the whole hub.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The stack is a ref (always current inside async code); the label is state
  // so the Undo button re-renders when it changes.
  const undoStack = useRef<UndoEntry[]>([])
  const [undoLabel, setUndoLabel] = useState<string | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    listTasks()
      .then((loaded) => {
        if (!cancelled) setTasks(loaded)
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

  const syncUndoLabel = () => setUndoLabel(undoStack.current.at(-1)?.label ?? null)

  /** Runs one storage action, records its undo, and reloads the list. */
  const run = useCallback(async (action: () => Promise<UndoEntry>): Promise<boolean> => {
    setError(null)
    try {
      const entry = await action()
      undoStack.current = [...undoStack.current, entry].slice(-MAX_UNDO)
      syncUndoLabel()
      setTasks(await listTasks())
      return true
    } catch (e) {
      setError(messageOf(e))
      return false
    }
  }, [])

  const add = useCallback(
    (title: string) =>
      run(async () => {
        const task = await addTask(title)
        return { label: `add "${task.title}"`, undo: () => removeTask(task.id) }
      }),
    [run],
  )

  const toggle = useCallback(
    (task: Task) =>
      run(async () => {
        await updateTask(task.id, { done: !task.done })
        return {
          label: `${task.done ? 'uncheck' : 'check'} "${task.title}"`,
          undo: () => updateTask(task.id, { done: task.done }),
        }
      }),
    [run],
  )

  const rename = useCallback(
    async (task: Task, title: string) => {
      // No real change, so nothing to save and nothing worth an undo step.
      if (title.trim() === task.title) return true
      return run(async () => {
        const updated = await updateTask(task.id, { title })
        return {
          label: `rename "${task.title}" to "${updated.title}"`,
          undo: () => updateTask(task.id, { title: task.title }),
        }
      })
    },
    [run],
  )

  const remove = useCallback(
    (task: Task) =>
      run(async () => {
        const removed = await removeTask(task.id)
        return { label: `delete "${task.title}"`, undo: () => restoreTask(removed) }
      }),
    [run],
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
      setTasks(await listTasks())
    } catch (e) {
      setError(`Couldn't undo: ${messageOf(e)}`)
    } finally {
      busy.current = false
    }
  }, [])

  return { tasks, loading, error, add, toggle, rename, remove, undo, undoLabel }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
