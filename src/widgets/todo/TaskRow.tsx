import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Category } from '../../storage/categories'
import type { Task, TaskChanges } from '../../storage/tasks'
import { PASTEL_BG } from '../../theme/pastels'
import { describeDue, type DueTone } from './dates'
import { PRIORITY_META } from './priority'
import { TaskDetailsFields, type DetailsDraft } from './TaskDetailsFields'

interface TaskRowProps {
  task: Task
  /** The task's category, or undefined if it has none. */
  category: Category | undefined
  categories: Category[]
  today: string
  popping: boolean
  onToggle: () => void
  onSave: (changes: TaskChanges) => void
  onRemove: () => void
  onCreateCategory: (name: string) => Promise<Category | undefined>
}

const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'bg-rose font-semibold',
  today: 'bg-butter font-semibold',
  soon: 'border border-ink/25',
  later: 'border border-dashed border-ink/25 text-ink-soft',
}

const pickDetails = (task: Task): DetailsDraft => ({
  priority: task.priority,
  categoryId: task.categoryId,
  dueDate: task.dueDate,
})

export function TaskRow(props: TaskRowProps) {
  const { task, category, categories, today, popping, onToggle, onSave, onRemove } = props
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [details, setDetails] = useState<DetailsDraft>(() => pickDetails(task))
  // Several things can end an edit at once (Enter, then the form unmounting
  // fires blur). This flag makes sure only the first one counts.
  const finished = useRef(false)
  const refocusEditButton = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const metaId = useId()

  // After Enter/Escape, put keyboard focus back on the pencil instead of losing it.
  useEffect(() => {
    if (!editing && refocusEditButton.current) {
      refocusEditButton.current = false
      editButton.current?.focus()
    }
  }, [editing])

  function startEditing() {
    finished.current = false
    setTitleDraft(task.title)
    setDetails(pickDetails(task))
    setEditing(true)
  }

  function finishEditing(save: boolean, returnFocus: boolean) {
    if (finished.current) return
    finished.current = true
    // A cleared title keeps the old one instead of counting as delete; that's the × button's job.
    if (save) onSave({ ...details, ...(titleDraft.trim() ? { title: titleDraft } : {}) })
    refocusEditButton.current = returnFocus
    setEditing(false)
  }

  // Save when focus leaves the whole form (clicking elsewhere on the page), not
  // when it moves between the form's own fields.
  function handleBlur() {
    // Wait a tick: during the blur event, document.activeElement hasn't moved yet.
    setTimeout(() => {
      const form = formRef.current
      if (form && !form.contains(document.activeElement)) finishEditing(true, false)
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    finishEditing(true, true)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      finishEditing(false, true)
    }
  }

  if (editing) {
    return (
      <li className="border-b border-dashed border-ink/15 py-2 last:border-b-0">
        <form
          ref={formRef}
          aria-label={`Edit "${task.title}"`}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex flex-col gap-2"
        >
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            // Caret at the end, the usual spot for fixing a typo or adding a word.
            onFocus={(e) => {
              const end = e.currentTarget.value.length
              e.currentTarget.setSelectionRange(end, end)
            }}
            aria-label={`Edit title of "${task.title}"`}
            className="w-full rounded-sm border-2 border-ink/50 bg-paper px-2 py-0.5 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <TaskDetailsFields
              value={details}
              onChange={setDetails}
              categories={categories}
              onCreateCategory={props.onCreateCategory}
            />
          </div>
          <div className="flex justify-end gap-2 text-sm">
            {/* preventDefault on mousedown keeps focus in the form (Safari doesn't
                focus clicked buttons), so the click isn't mistaken for "clicked away". */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => finishEditing(false, true)}
              className="rounded-full px-3 py-1 text-ink-soft hover:bg-paper hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()}
              className="rounded-full bg-mint px-3 py-1 hover:bg-mint/70"
            >
              Save
            </button>
          </div>
        </form>
      </li>
    )
  }

  const due = task.dueDate ? describeDue(task.dueDate, today, task.done) : null
  const priority = PRIORITY_META[task.priority]
  const showMeta = task.priority < 4 || category || due
  // One plain sentence for screen readers. Reading the chips directly would run
  // them together ("SchoolDueTomorrow"): inline elements get no spaces between them.
  const description = [
    task.priority < 4 && `${priority.label} priority`,
    category?.name,
    due && (due.tone === 'overdue' ? `overdue, was due ${due.full}` : `due ${due.text}`),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="group flex items-center gap-3 border-b border-dashed border-ink/15 py-2 last:border-b-0">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <span className="relative grid shrink-0 place-items-center">
          {/* A real checkbox restyled with appearance-none keeps keyboard and screen-reader support. */}
          <input
            type="checkbox"
            checked={task.done}
            onChange={onToggle}
            // Named by the title alone; the chips are read as a description after it.
            aria-labelledby={titleId}
            aria-describedby={showMeta ? metaId : undefined}
            className={`peer size-5 cursor-pointer appearance-none rounded-full border-2 border-ink/50 bg-card transition-colors checked:border-ink checked:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${popping ? 'motion-safe:animate-pop' : ''}`}
          />
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="pointer-events-none absolute size-3 text-ink opacity-0 peer-checked:opacity-100"
          >
            <path
              d="M2.5 6.5l2.5 2.5 4.5-5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            id={titleId}
            className={`relative self-start break-words transition-colors ${task.done ? 'text-ink-soft' : ''}`}
          >
            {task.title}
            {/* Hand-drawn-ish strike line that sweeps left to right when checked. */}
            <span
              aria-hidden
              className={`absolute top-1/2 left-0 h-0.5 w-full origin-left rounded-full bg-ink/60 transition-transform duration-300 ease-out motion-reduce:transition-none ${task.done ? 'scale-x-100' : 'scale-x-0'}`}
            />
          </span>
          {showMeta && (
            <span id={metaId} className="sr-only">
              {description}
            </span>
          )}
          {showMeta && (
            <span aria-hidden className="mt-1 flex flex-wrap gap-1.5 text-xs">
              {/* Low is the default, so it gets no chip; only flagged tasks stand out. */}
              {task.priority < 4 && (
                <span className={`rounded-full px-2 py-0.5 ${priority.badge}`}>
                  {priority.label}
                </span>
              )}
              {category && (
                <span className={`rounded-full px-2 py-0.5 ${PASTEL_BG[category.color]}`}>
                  {category.name}
                </span>
              )}
              {due && (
                <time
                  dateTime={task.dueDate ?? undefined}
                  title={due.full}
                  className={`rounded-full px-2 py-0.5 ${DUE_TONE_CLASS[due.tone]}`}
                >
                  {due.text}
                </time>
              )}
            </span>
          )}
        </span>
      </label>
      {/* Hidden until hover/focus on mouse devices; always visible on touch screens. */}
      <div className="flex shrink-0 items-center gap-0.5 group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100">
        <button
          ref={editButton}
          type="button"
          onClick={startEditing}
          aria-label={`Edit "${task.title}"`}
          className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-butter hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <path
              d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete "${task.title}"`}
          className="grid size-7 place-items-center rounded-full text-lg leading-none text-ink-soft hover:bg-rose hover:text-ink"
        >
          ×
        </button>
      </div>
    </li>
  )
}
