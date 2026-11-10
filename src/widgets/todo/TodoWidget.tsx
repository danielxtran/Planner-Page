import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { isUndoShortcut } from '../../state/keyboard'
import { useUndoStore } from '../../state/undoStore'
import type { Task } from '../../storage/tasks'
import type { WidgetProps } from '../registry'
import { WidgetCard } from '../WidgetCard'
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
import { describeFilter, draftDefaultsFor, readTodoConfig } from './todoConfig'
import { useTasks } from './useTasks'

const DEFAULT_TITLE = 'To-do'

/**
 * A to-do list showing the tasks that match this widget's saved filter. Every
 * to-do widget reads the same shared task list; only the filter differs, which
 * is how "School this week" and "Work urgent" can sit side by side.
 */
export function TodoWidget({ widget, onConfigChange, onAddBelow }: WidgetProps) {
  const { tasks, categories, loading, add, toggle, edit, remove, createCategory } = useTasks()
  const undo = useUndoStore((s) => s.undo)
  const { title, filter } = readTodoConfig(widget.config)
  const [draft, setDraft] = useState('')
  // null = untouched, so the pickers follow the filter's defaults (see draftDefaultsFor).
  const [draftChoice, setDraftChoice] = useState<DetailsDraft | null>(null)
  // Title of a just-added task that the current filters hide, so it doesn't seem to vanish.
  const [hiddenNotice, setHiddenNotice] = useState<string | null>(null)
  // Only the task just checked gets the pop, so done tasks don't all bounce on page load.
  const [poppedId, setPoppedId] = useState<string | null>(null)

  const today = todayString()
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  // Ignore categories that no longer exist (e.g. deleted, or creation undone),
  // so a stale id can't silently filter everything out or fail an add.
  const activeFilter: TaskFilter = {
    ...filter,
    categoryIds: filter.categoryIds.filter((id) => id === null || categoryById.has(id)),
  }
  const draftDefaults = draftDefaultsFor(activeFilter, today)
  const chosen = draftChoice ?? draftDefaults
  const draftDetails: DetailsDraft = {
    ...chosen,
    categoryId: chosen.categoryId && categoryById.has(chosen.categoryId) ? chosen.categoryId : null,
  }
  const visible = applyFilter(tasks, activeFilter, today)
  const filtering = countActiveFilters(activeFilter) > 0
  const showDraftDetails =
    draft.trim() !== '' || JSON.stringify(draftDetails) !== JSON.stringify(draftDefaults)
  // Counted over this widget's tasks, so a "School" widget shows School progress.
  const doneCount = visible.filter((t) => t.done).length

  function changeFilter(next: TaskFilter) {
    onConfigChange('change filter', { ...widget.config, filter: next })
    setHiddenNotice(null)
  }

  function rename(nextTitle: string) {
    onConfigChange('rename widget', { ...widget.config, title: nextTitle })
  }

  function saveFilterAsWidget() {
    const config = { title: describeFilter(activeFilter, categories), filter: activeFilter }
    onAddBelow({ id: crypto.randomUUID(), type: 'todo', config }, 'save filter as widget')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    const task = await add(draft, draftDetails)
    if (!task) return
    setDraft('')
    setDraftChoice(null)
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

  return (
    <WidgetCard
      title={title.trim() || DEFAULT_TITLE}
      defaultTitle={DEFAULT_TITLE}
      onRename={rename}
      tape="lavender"
      aside={visible.length > 0 && `${doneCount} of ${visible.length} done`}
    >
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
            value={draftDetails}
            onChange={setDraftChoice}
            categories={categories}
            onCreateCategory={createCategory}
          />
        </div>
      </form>

      {tasks.length > 0 && (
        <FilterBar
          filter={activeFilter}
          onChange={changeFilter}
          categories={categories}
          onSaveAsWidget={saveFilterAsWidget}
        />
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
    </WidgetCard>
  )
}
