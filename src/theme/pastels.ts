import type { CategoryColor } from '../storage/categories'

// Full class names written out so Tailwind's source scanner finds them;
// a constructed `bg-${color}` would never get its CSS generated.
export const PASTEL_BG: Record<CategoryColor, string> = {
  peach: 'bg-peach',
  mint: 'bg-mint',
  lavender: 'bg-lavender',
  butter: 'bg-butter',
  sky: 'bg-sky',
  rose: 'bg-rose',
}
