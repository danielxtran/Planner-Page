import type { Priority } from '../../storage/tasks'

// Storage keeps priorities as numbers 1-4 (easy to sort and filter); these are
// the names people see. Full class names, never built like `bg-${x}`: Tailwind
// finds classes by scanning source text, so a constructed name would get no CSS.
export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  1: { label: 'Top', badge: 'bg-rose' },
  2: { label: 'High', badge: 'bg-peach' },
  3: { label: 'Average', badge: 'bg-butter' },
  4: { label: 'Low', badge: 'bg-sky' },
}
