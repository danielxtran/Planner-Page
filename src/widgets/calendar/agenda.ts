import { addDays, format, parseISO } from 'date-fns'
import type { CalendarEvent, CalendarSource } from '../../storage/calendars'
import type { CategoryColor } from '../../storage/categories'
import type { Task } from '../../storage/tasks'
import { localDate } from './syncWindow'

export interface AgendaItem {
  key: string
  kind: 'event' | 'task'
  title: string
  /** "9:30 AM", or null for all-day events and tasks. */
  time: string | null
  color: CategoryColor | null
  url: string | null
  location: string | null
  /** Tasks only: due before today and still open. */
  overdue: boolean
  /** For ordering within a day: all-day and tasks first, then by time. */
  sortKey: string
}

export interface AgendaDay {
  /** 'yyyy-MM-dd' */
  date: string
  items: AgendaItem[]
}

interface AgendaInput {
  events: CalendarEvent[]
  sources: CalendarSource[]
  tasks: Task[]
  /** null = every source. */
  sourceIds: string[] | null
  days: number
  showTasks: boolean
  today: Date
}

/**
 * Groups events (and tasks with due dates) by local day for the next `days`
 * days, starting today. Days with nothing on them are left out, so the
 * agenda stays short. Pure: the same input always gives the same agenda.
 */
export function buildAgenda(input: AgendaInput): AgendaDay[] {
  const dates = Array.from({ length: input.days }, (_, i) => localDate(addDays(input.today, i)))
  const first = dates[0]
  const last = dates[dates.length - 1]
  const byDate = new Map<string, AgendaItem[]>(dates.map((d) => [d, []]))
  const shown = new Map(
    input.sources
      .filter((s) => input.sourceIds === null || input.sourceIds.includes(s.id))
      .map((s) => [s.id, s]),
  )

  for (const event of input.events) {
    const source = shown.get(event.sourceId)
    if (!source) continue
    for (const date of daysOf(event)) {
      byDate.get(date)?.push({
        key: `${event.id}:${date}`,
        kind: 'event',
        title: event.title,
        time: event.allDay ? null : format(parseISO(event.start), 'h:mm a'),
        color: source.color,
        url: event.url,
        location: event.location,
        overdue: false,
        sortKey: event.allDay ? '0' : `1${parseISO(event.start).toISOString()}`,
      })
    }
  }

  if (input.showTasks) {
    for (const task of input.tasks) {
      if (task.done || !task.dueDate || task.dueDate > last) continue
      // Overdue tasks gather under today instead of disappearing into the past.
      const overdue = task.dueDate < first
      byDate.get(overdue ? first : task.dueDate)?.push({
        key: `task:${task.id}`,
        kind: 'task',
        title: task.title,
        time: null,
        color: null,
        url: null,
        location: null,
        overdue,
        sortKey: `0${overdue ? 0 : 1}${task.priority}`,
      })
    }
  }

  return dates
    .map((date) => ({
      date,
      items: (byDate.get(date) ?? []).sort((a, b) =>
        a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
      ),
    }))
    .filter((day) => day.items.length > 0)
}

/**
 * The local days an event is on. A timed event is on the day it starts (in
 * the viewer's time zone). An all-day event is on every day from its start up
 * to, but not including, its end date, like in iCal.
 */
function daysOf(event: CalendarEvent): string[] {
  if (!event.allDay) return [localDate(parseISO(event.start))]
  const days: string[] = []
  let day = parseISO(event.start)
  const end = event.end ? parseISO(event.end) : addDays(day, 1)
  // At most 60 days, in case a feed has a months-long "event".
  for (let i = 0; i < 60 && day < end; i++, day = addDays(day, 1)) days.push(localDate(day))
  return days.length > 0 ? days : [event.start]
}

/** "Today", "Tomorrow", or "Thu, Nov 13". */
export function dayHeading(date: string, today: Date): string {
  if (date === localDate(today)) return 'Today'
  if (date === localDate(addDays(today, 1))) return 'Tomorrow'
  return format(parseISO(date), 'EEE, MMM d')
}
