import { useRef } from 'react'
import type { Category } from '../../storage/categories'
import { PRIORITIES, type Priority, type Task } from '../../storage/tasks'
import { CategoryPicker } from './CategoryPicker'
import { PRIORITY_META } from './priority'
import { controlClass } from './styles'

export type DetailsDraft = Pick<Task, 'priority' | 'categoryId' | 'dueDate'>

interface TaskDetailsFieldsProps {
  value: DetailsDraft
  onChange: (value: DetailsDraft) => void
  categories: Category[]
  onCreateCategory: (name: string) => Promise<Category | undefined>
}

/** Priority, category, and due date pickers, shared by quick-add and task editing. */
export function TaskDetailsFields({
  value,
  onChange,
  categories,
  onCreateCategory,
}: TaskDetailsFieldsProps) {
  const dateRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <select
        aria-label="Priority"
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: Number(e.target.value) as Priority })}
        className={controlClass}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
      <CategoryPicker
        value={value.categoryId}
        categories={categories}
        onChange={(categoryId) => onChange({ ...value, categoryId })}
        onCreate={onCreateCategory}
      />
      <span className="inline-flex items-center gap-0.5">
        <input
          ref={dateRef}
          type="date"
          aria-label="Due date"
          value={value.dueDate ?? ''}
          // An emptied date input reports '', which we store as "no date".
          onChange={(e) => onChange({ ...value, dueDate: e.target.value || null })}
          className={controlClass}
        />
        {value.dueDate && (
          <button
            type="button"
            aria-label="Clear due date"
            onClick={() => {
              // Move focus off this button before it disappears (see CategoryPicker).
              dateRef.current?.focus()
              onChange({ ...value, dueDate: null })
            }}
            className="grid size-6 place-items-center rounded-full text-ink-soft hover:bg-rose hover:text-ink"
          >
            ×
          </button>
        )}
      </span>
    </>
  )
}
