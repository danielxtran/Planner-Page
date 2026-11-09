import { useRef, useState, type KeyboardEvent } from 'react'
import type { Category } from '../../storage/categories'
import { controlClass } from './styles'

const NEW_CATEGORY = '__new__'

interface CategoryPickerProps {
  value: string | null
  categories: Category[]
  onChange: (categoryId: string | null) => void
  /** Resolves to the new (or existing same-named) category, or undefined on failure. */
  onCreate: (name: string) => Promise<Category | undefined>
}

/** A category dropdown whose last option turns into a "name your new category" box. */
export function CategoryPicker({ value, categories, onChange, onCreate }: CategoryPickerProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)

  // Focus moves back to the dropdown *before* the name box disappears, so focus
  // never falls to <body>. The task edit form reads that as "clicked away, save".
  function stopCreating() {
    selectRef.current?.focus()
    setCreating(false)
    setName('')
  }

  async function submit() {
    if (!name.trim()) return stopCreating()
    const category = await onCreate(name)
    if (category) {
      onChange(category.id)
      stopCreating()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Handle Enter/Escape here and stop them reaching the surrounding form,
    // where they would add the task or cancel the whole edit.
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      void submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      stopCreating()
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        ref={selectRef}
        aria-label="Category"
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) setCreating(true)
          else onChange(e.target.value || null)
        }}
        className={controlClass}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ New category…</option>
      </select>
      {creating && (
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New category name"
          placeholder="Name, then Enter"
          className={`${controlClass} w-36`}
        />
      )}
    </span>
  )
}
