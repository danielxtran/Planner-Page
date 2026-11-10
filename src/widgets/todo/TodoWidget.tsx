import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { isUndoShortcut } from '../../state/keyboard'
import { useUndoStore } from '../../state/undoStore'
import { DEFAULT_PRIORITY, type Task } from '../../storage/tasks'
import { todayString } from './dates'
import { FilterBar } from './FilterBar'
import { TaskDetailsFields, type DetailsDraft } from './TaskDetailsFields'
import {
  applyFilter,
  countActiveFilters,
  DEFAULT_FILTER,
  matchesFilter,
  type TaskFilter,
} from './taskFilter'
import { TaskRow } from './TaskRow'
import { useTasks } from './useTasks'

const EMPTY_DETAILS: DetailsDraft = { priority: DEFAULT_PRIORITY, categoryId: null, dueDate: null }

export function TodoWidget() {
  const { tasks, categories, loading, add, toggle, edit, remove, createCategory } = useTasks()
  const undo = useUndoStore((s) => s.undo)
  // Unique per widget instance: a page can now hold several to-do widgets.
  const headingId = useId()
  const [draft, setDraft] = useState('')
  const [draftDetails, setDraftDetails] = useState<DetailsDraft>(EMPTY_DETAILS)
  // In memory for now; in milestones 3-4 the filter becomes saved widget config.
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_FILTER)
  // Title of a just-added task that the current filters hide, so it doesn't seem to vanish.
  const [hiddenNotice, setHiddenNotice] = useState<string | null>(null)
  // Only the task just checked gets the pop, so done tasks don't all bounce on page load.
  const [poppedId, setPoppedId] = useState<string | null>(null)

  const today = todayString()
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  // Ignore categories that no longer exist (e.g. after undoing their creation),
  // so a stale id can't silently filter everything out or fail an add.
  const activeFilter: TaskFilter = {
    ...filter,
    categoryIds: filter.categoryIds.filter((id) => id === null || categoryById.has(id)),
  }
  const draftCategoryId =
    draftDetails.categoryId && categoryById.has(draftDetails.categoryId)
      ? draftDetails.categoryId
      : null
  const visible = applyFilter(tasks, activeFilter, today)
  const filtering = countActiveFilters(activeFilter) > 0
  const showDraftDetails =
    draft.trim() !== '' ||
    draftDetails.priority !== EMPTY_DETAILS.priority ||
    draftCategoryId !== null ||
    draftDetails.dueDate !== null

  function changeFilter(next: TaskFilter) {
    setFilter(next)
    setHiddenNotice(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    const task = await add(draft, { ...draftDetails, categoryId: draftCategoryId })
    if (!task) return
    setDraft('')
    setDraftDetails(EMPTY_DETAILS)
    setHiddenNotice(matchesFilter(task, activeFilter, today) ? null : task.title)
  }

  // Right after quick-adding, the box is empty, so Ctrl+Z there has no text to
  // undo. Treat it as "undo the last action" instead. (The page-wide Ctrl+Z
  // lives in the hub toolbar and skips text fields on purpose.)
  function handleDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (isUndoShortcut(e) && draft === '') {
      e.preventDefault()
      void undo()
    }
  }

  function handleToggle(task: Task) {
    setPoppedId(task.done ? null : task.id)
    void toggle(task)
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <section
      aria-labelledby={headingId}
      className="relative rounded-sm bg-card p-5 pt-7 shadow-[2px_3px_0_rgb(61_53_80/0.12)]"
    >
      {/* Washi tape strip, purely decorative. */}
      <div
        aria-hidden
        className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-lavender/80"
      />

      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-hand text-3xl font-bold">
          To-do
        </h2>
        {tasks.length > 0 && (
          <p className="text-sm text-ink-soft">
            {doneCount} of {tasks.length} done
          </p>
        )}
      </header>

      {/* `group` lets the detail pickers show while anything in this form has focus. */}
      <form aria-label="Add task" onSubmit={handleSubmit} className="group">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleDraftKeyDown}
          aria-label="New task"
          placeholder="Add a task and press Enter"
          className="w-full rounded-sm border-2 border-dashed border-ink/25 bg-paper px-3 py-2 placeholder:text-ink-soft focus:border-solid focus:border-ink/50 focus:outline-none"
        />
        {/* Tucked away until you're adding something, so the widget stays calm. */}
        <div
          className={`mt-2 flex-wrap items-center gap-2 ${showDraftDetails ? 'flex' : 'hidden group-focus-within:flex'}`}
        >
          <TaskDetailsFields
            value={{ ...draftDetails, categoryId: draftCategoryId }}
            onChange={setDraftDetails}
            categories={categories}
            onCreateCategory={createCategory}
          />
        </div>
      </form>

      {tasks.length > 0 && (
        <FilterBar filter={activeFilter} onChange={changeFilter} categories={categories} />
      )}

      {hiddenNotice && (
        <p role="status" className="mt-3 rounded-sm bg-butter px-3 py-2 text-sm">
          Added "{hiddenNotice}", but your filters are hiding it.{' '}
          <button
            type="button"
            onClick={() => changeFilter({ ...DEFAULT_FILTER, sort: filter.sort })}
            className="underline underline-offset-2"
          >
            Show all
          </button>
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-ink-soft">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-4 font-hand text-2xl text-ink-soft">Nothing to do. Enjoy it!</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 font-hand text-2xl text-ink-soft">No tasks match these filters.</p>
      ) : (
        <>
          {filtering && (
            <p className="mt-3 text-xs text-ink-soft">
              Showing {visible.length} of {tasks.length}
            </p>
          )}
          <ul className="mt-2">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                category={task.categoryId ? categoryById.get(task.categoryId) : undefined}
                categories={categories}
                today={today}
                popping={task.id === poppedId && task.done}
                onToggle={() => handleToggle(task)}
                onSave={(changes) => void edit(task, changes)}
                onRemove={() => void remove(task)}
                onCreateCategory={createCategory}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
