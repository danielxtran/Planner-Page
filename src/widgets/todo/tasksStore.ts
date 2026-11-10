import { create } from 'zustand'
import { useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
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

interface TasksData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  tasks: Task[]
  categories: Category[]
}

interface TasksActions {
  /** Loads from storage the first time any to-do widget mounts; later calls do nothing. */
  ensureLoaded: () => Promise<void>
  add: (title: string, details?: TaskDetails) => Promise<Task | undefined>
  toggle: (task: Task) => Promise<boolean | undefined>
  edit: (task: Task, changes: TaskChanges) => Promise<boolean>
  remove: (task: Task) => Promise<boolean | undefined>
  /** Creates a category, or returns the existing one if the name is already taken. */
  createCategory: (name: string) => Promise<Category | undefined>
}

/** What a storage action hands back to `run`: its result plus how to reverse it. */
interface Step<T> {
  value: T
  label: string
  undo: () => Promise<unknown>
}

/** Exported so tests can reset the store between cases. */
export const initialTasksState: TasksData = { status: 'idle', tasks: [], categories: [] }

/**
 * Tasks and categories shared by every to-do widget on the page, so adding a
 * task in one widget shows up in all of them. Every action saves immediately
 * through the storage modules and pushes its reversal onto the app-wide undo stack.
 */
export const useTasksStore = create<TasksData & TasksActions>()((set, get) => {
  async function reload() {
    const [tasks, categories] = await Promise.all([listTasks(), listCategories()])
    set({ tasks, categories })
  }

  /**
   * Runs one storage action, records its undo, and reloads.
   * Resolves to the action's value, or undefined if it failed (the error is reported).
   */
  async function run<T>(action: () => Promise<Step<T>>): Promise<T | undefined> {
    const errors = useErrorStore.getState()
    errors.clear()
    try {
      const { value, label, undo } = await action()
      useUndoStore.getState().push({
        label,
        undo: async () => {
          await undo()
          await reload()
        },
      })
      await reload()
      return value
    } catch (e) {
      errors.report(e)
      return undefined
    }
  }

  return {
    ...initialTasksState,

    ensureLoaded: async () => {
      if (get().status !== 'idle') return
      set({ status: 'loading' })
      try {
        await reload()
        set({ status: 'ready' })
      } catch (e) {
        set({ status: 'error' })
        useErrorStore.getState().report(e)
      }
    },

    add: (title, details = {}) =>
      run(async () => {
        const task = await addTask(title, details)
        return { value: task, label: `add "${task.title}"`, undo: () => removeTask(task.id) }
      }),

    toggle: (task) =>
      run(async () => {
        await updateTask(task.id, { done: !task.done })
        return {
          value: true,
          label: `${task.done ? 'uncheck' : 'check'} "${task.title}"`,
          undo: () => updateTask(task.id, { done: task.done }),
        }
      }),

    // Saves only the fields that actually changed, so undo restores exactly those.
    edit: async (task, changes) => {
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

    remove: (task) =>
      run(async () => {
        const removed = await removeTask(task.id)
        return { value: true, label: `delete "${task.title}"`, undo: () => restoreTask(removed) }
      }),

    createCategory: async (name) => {
      const existing = get().categories.find((c) => sameName(c.name, name))
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
  }
})
