import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

/** A Date as the local 'yyyy-MM-dd' calendar date that Task.dueDate uses. */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function todayString(): string {
  return toDateString(new Date())
}

export function addDaysTo(dateString: string, days: number): string {
  return toDateString(addDays(parseISO(dateString), days))
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export interface DueLabel {
  /** Short text for the chip, e.g. "Tomorrow" or "Fri". */
  text: string
  tone: DueTone
  /** Unambiguous full date, for tooltips and screen readers. */
  full: string
}

/** How a due date reads relative to today. Done tasks are never shown as overdue. */
export function describeDue(dueDate: string, today: string, done: boolean): DueLabel {
  // parseISO reads a date-only string as local midnight, which is what we want.
  const date = parseISO(dueDate)
  const days = differenceInCalendarDays(date, parseISO(today))
  const full = format(date, 'EEEE, MMMM d, yyyy')
  const short = format(
    date,
    date.getFullYear() === parseISO(today).getFullYear() ? 'MMM d' : 'MMM d, yyyy',
  )

  if (days < 0 && !done) return { text: `Overdue · ${short}`, tone: 'overdue', full }
  if (days === 0) return { text: 'Today', tone: 'today', full }
  if (days === 1) return { text: 'Tomorrow', tone: 'soon', full }
  if (days === -1) return { text: 'Yesterday', tone: 'later', full }
  // Within the coming week the weekday alone is clear ("Fri").
  if (days > 1 && days < 7) return { text: format(date, 'EEE'), tone: 'soon', full }
  return { text: short, tone: 'later', full }
}
