import { addDays, startOfDay } from 'date-fns'

/** How far back and ahead a sync copies events. Enough for "this week" and planning a term ahead. */
export const DAYS_BACK = 14
export const DAYS_AHEAD = 120

export function syncWindow(now = new Date()) {
  const today = startOfDay(now)
  return { from: addDays(today, -DAYS_BACK), to: addDays(today, DAYS_AHEAD) }
}

/** 'yyyy-MM-dd' for a Date, in local time. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
