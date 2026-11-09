import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Task } from '../../storage/tasks'
import { useTasks } from './useTasks'

export function TodoWidget() {
  const { tasks, loading, error, add, toggle, rename, remove, undo, undoLabel } = useTasks()
  const [draft, setDraft] = useState('')
  // Only the task just checked gets the pop, so done tasks don't all bounce on page load.
  const [poppedId, setPoppedId] = useState<string | null>(null)

  // Ctrl/Cmd+Z anywhere on the page undoes the last task action, except while
  // typing in a field, where it keeps doing normal text undo.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (isUndoShortcut(e) && !isEditable(e.target)) {
        e.preventDefault()
        void undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    if (await add(draft)) setDraft('')
  }

  // Right after quick-adding, the box is empty, so Ctrl+Z there has no text to
  // undo. Treat it as "undo the last task action" instead.
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
      aria-labelledby="todo-heading"
      className="relative rounded-sm bg-card p-5 pt-7 shadow-[2px_3px_0_rgb(61_53_80/0.12)]"
    >
      {/* Washi tape strip, purely decorative. */}
      <div
        aria-hidden
        className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-lavender/80"
      />

      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="todo-heading" className="font-hand text-3xl font-bold">
          To-do
        </h2>
        {tasks.length > 0 && (
          <p className="text-sm text-ink-soft">
            {doneCount} of {tasks.length} done
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleDraftKeyDown}
          aria-label="New task"
          placeholder="Add a task and press Enter"
          className="w-full rounded-sm border-2 border-dashed border-ink/25 bg-paper px-3 py-2 placeholder:text-ink-soft focus:border-solid focus:border-ink/50 focus:outline-none"
        />
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-rose px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-ink-soft">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-4 font-hand text-2xl text-ink-soft">Nothing to do. Enjoy it!</p>
      ) : (
        <ul className="mt-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              popping={task.id === poppedId && task.done}
              onToggle={() => handleToggle(task)}
              onRename={(title) => void rename(task, title)}
              onRemove={() => void remove(task)}
            />
          ))}
        </ul>
      )}

      {undoLabel && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-dashed border-ink/20 pt-3 text-sm text-ink-soft">
          <span className="truncate">Last: {undoLabel}</span>
          <button
            type="button"
            onClick={() => void undo()}
            className="shrink-0 rounded-full bg-sky px-3 py-1 text-ink hover:bg-sky/70"
          >
            Undo <kbd className="font-sans text-xs text-ink-soft">Ctrl+Z</kbd>
          </button>
        </div>
      )}
    </section>
  )
}

interface TaskRowProps {
  task: Task
  popping: boolean
  onToggle: () => void
  onRename: (title: string) => void
  onRemove: () => void
}

function TaskRow({ task, popping, onToggle, onRename, onRemove }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  // Enter/Escape end editing, then the input unmounting can fire blur as well.
  // This flag makes sure only the first of those counts.
  const finished = useRef(false)
  const refocusEditButton = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)

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
    setEditing(true)
  }

  function finishEditing(save: boolean, returnFocus: boolean) {
    if (finished.current) return
    finished.current = true
    // Clearing the title counts as "never mind", not a save; deleting is the × button's job.
    if (save && titleDraft.trim()) onRename(titleDraft)
    refocusEditButton.current = returnFocus
    setEditing(false)
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEditing(true, true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finishEditing(false, true)
    }
  }

  if (editing) {
    return (
      <li className="flex items-center gap-3 border-b border-dashed border-ink/15 py-2 last:border-b-0">
        {/* Spacer the size of the checkbox so the text doesn't jump sideways. */}
        <span aria-hidden className="size-5 shrink-0" />
        <input
          type="text"
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={() => finishEditing(true, false)}
          // Caret at the end, the usual spot for fixing a typo or adding a word.
          onFocus={(e) => {
            const end = e.currentTarget.value.length
            e.currentTarget.setSelectionRange(end, end)
          }}
          aria-label={`Edit title of "${task.title}"`}
          className="min-w-0 flex-1 rounded-sm border-2 border-ink/50 bg-paper px-2 py-0.5 focus:outline-none"
        />
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-3 border-b border-dashed border-ink/15 py-2 last:border-b-0">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <span className="relative grid shrink-0 place-items-center">
          {/* A real checkbox restyled with appearance-none keeps keyboard and screen-reader support. */}
          <input
            type="checkbox"
            checked={task.done}
            onChange={onToggle}
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
        <span
          className={`relative min-w-0 break-words transition-colors ${task.done ? 'text-ink-soft' : ''}`}
        >
          {task.title}
          {/* Hand-drawn-ish strike line that sweeps left to right when checked. */}
          <span
            aria-hidden
            className={`absolute top-1/2 left-0 h-0.5 w-full origin-left rounded-full bg-ink/60 transition-transform duration-300 ease-out motion-reduce:transition-none ${task.done ? 'scale-x-100' : 'scale-x-0'}`}
          />
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

function isUndoShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
  return e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}
