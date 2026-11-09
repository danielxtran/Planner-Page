import { useId, useState, type ReactNode } from 'react'
import type { Category } from '../../storage/categories'
import { PRIORITIES } from '../../storage/tasks'
import { PASTEL_BG } from '../../theme/pastels'
import { PRIORITY_META } from './priority'
import { controlClass } from './styles'
import {
  countActiveFilters,
  DEFAULT_FILTER,
  type DueFilter,
  type SortKey,
  type StatusFilter,
  type TaskFilter,
} from './taskFilter'

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ['all', 'All'],
  ['open', 'To do'],
  ['done', 'Done'],
]

const DUE_OPTIONS: [DueFilter, string][] = [
  ['any', 'Any'],
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['next7', 'Next 7 days'],
  ['none', 'No date'],
]

interface FilterBarProps {
  filter: TaskFilter
  onChange: (filter: TaskFilter) => void
  categories: Category[]
}

/** Sort menu plus a collapsible panel of filter chips. Collapsed by default to keep things calm. */
export function FilterBar({ filter, onChange, categories }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const active = countActiveFilters(filter)
  const set = (changes: Partial<TaskFilter>) => onChange({ ...filter, ...changes })

  return (
    <div className="mt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={`${controlClass} ${active > 0 ? 'bg-lavender' : ''}`}
        >
          Filters{active > 0 && ` · ${active}`} <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        <label className="flex items-center gap-1.5 text-ink-soft">
          Sort
          <select
            value={filter.sort}
            onChange={(e) => set({ sort: e.target.value as SortKey })}
            className={controlClass}
          >
            <option value="created">Date added</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </label>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTER, sort: filter.sort })}
            className="rounded-full px-2 py-1 text-ink-soft underline decoration-dashed underline-offset-4 hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {open && (
        <div
          id={panelId}
          className="mt-2 space-y-2.5 rounded-sm border border-dashed border-ink/20 bg-paper p-3"
        >
          <FilterGroup label="Show">
            {STATUS_OPTIONS.map(([value, label]) => (
              <Chip
                key={value}
                pressed={filter.status === value}
                onClick={() => set({ status: value })}
              >
                {label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Priority">
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                pressed={filter.priorities.includes(p)}
                color={PRIORITY_META[p].badge}
                onClick={() => set({ priorities: toggleIn(filter.priorities, p) })}
              >
                {PRIORITY_META[p].label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Due">
            {DUE_OPTIONS.map(([value, label]) => (
              <Chip key={value} pressed={filter.due === value} onClick={() => set({ due: value })}>
                {label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Category">
            {categories.map((c) => (
              <Chip
                key={c.id}
                pressed={filter.categoryIds.includes(c.id)}
                color={PASTEL_BG[c.color]}
                onClick={() => set({ categoryIds: toggleIn(filter.categoryIds, c.id) })}
              >
                {c.name}
              </Chip>
            ))}
            <Chip
              pressed={filter.categoryIds.includes(null)}
              onClick={() => set({ categoryIds: toggleIn(filter.categoryIds, null) })}
            >
              No category
            </Chip>
          </FilterGroup>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span aria-hidden className="w-16 shrink-0 text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  )
}

interface ChipProps {
  pressed: boolean
  onClick: () => void
  /** Background when pressed; a full Tailwind class like 'bg-mint'. */
  color?: string
  children: ReactNode
}

/** A toggle button. The ✓ means "on" is shown by more than color alone. */
function Chip({ pressed, onClick, color = 'bg-lavender', children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${pressed ? `${color} border-ink/60` : 'border-dashed border-ink/30 hover:bg-card'}`}
    >
      {pressed && <span aria-hidden>✓</span>}
      {children}
    </button>
  )
}

function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}
