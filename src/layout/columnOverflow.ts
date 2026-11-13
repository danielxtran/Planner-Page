import { useSyncExternalStore } from 'react'

/**
 * "Show more" for tall columns. In a row of side-by-side columns, a column
 * that runs much longer than its neighbors is cut to the tallest neighbor's
 * height, with a button to see the rest, so one long list doesn't leave a
 * big empty gap under everything else in the row.
 */

/** A column is never cut shorter than this, even next to a tiny neighbor. */
export const MIN_COLLAPSED_HEIGHT = 260

/** How far past the limit a column may run before it's cut. Hiding just a few lines isn't worth a button. */
export const OVERFLOW_TOLERANCE = 80

/**
 * The height (px) to cut a column to, or null if it should show in full.
 * `heights` are the natural (uncut) content heights of the row's columns.
 */
export function collapsedHeight(heights: Record<string, number>, columnId: string): number | null {
  const own = heights[columnId]
  const others = Object.entries(heights)
    .filter(([id]) => id !== columnId)
    .map(([, height]) => height)
  if (own === undefined || others.length === 0) return null
  const limit = Math.max(MIN_COLLAPSED_HEIGHT, ...others)
  return own > limit + OVERFLOW_TOLERANCE ? limit : null
}

/** Columns sit side by side from Tailwind's `md` breakpoint (48rem) up; below it they stack. */
const SIDE_BY_SIDE = '(min-width: 48rem)'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(SIDE_BY_SIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether columns are side by side right now. Updates when the window is resized past the breakpoint. */
export function useColumnsSideBySide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && !!window.matchMedia?.(SIDE_BY_SIDE).matches,
    () => false,
  )
}
