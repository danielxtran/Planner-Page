import { describe, expect, it } from 'vitest'
import type { CalendarEvent, CalendarSource } from '../../storage/calendars'
import type { Task } from '../../storage/tasks'
import { buildAgenda, dayHeading } from './agenda'

const stamp = '2026-01-01T00:00:00.000Z'
const source = (id: string, color: CalendarSource['color'] = 'mint'): CalendarSource => ({
  id,
  userId: 'local-user',
  kind: 'canvas',
  name: id,
  color,
  feedUrl: 'https://x.instructure.com/feeds/calendars/a.ics',
  account: null,
  lastSyncedAt: null,
  lastError: null,
  createdAt: stamp,
  updatedAt: stamp,
})
const event = (
  sourceId: string,
  title: string,
  start: string,
  changes: Partial<CalendarEvent> = {},
) =>
  ({
    id: `${sourceId}:${title}`,
    userId: 'local-user',
    sourceId,
    title,
    start,
    end: null,
    allDay: !start.includes('T'),
    location: null,
    url: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...changes,
  }) satisfies CalendarEvent
const task = (title: string, dueDate: string | null, changes: Partial<Task> = {}): Task => ({
  id: title,
  userId: 'local-user',
  title,
  done: false,
  priority: 4,
  categoryId: null,
  dueDate,
  createdAt: stamp,
  updatedAt: stamp,
  ...changes,
})

// Local noon, so the test reads the same in any time zone.
const today = new Date(2026, 10, 11, 12, 0)
const localIso = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString()

const base = {
  sources: [source('canvas', 'peach'), source('google', 'sky')],
  tasks: [] as Task[],
  sourceIds: null,
  days: 3,
  showTasks: true,
  today,
}

describe('buildAgenda', () => {
  it('groups by day, all-day first then by time, and skips empty days', () => {
    const agenda = buildAgenda({
      ...base,
      events: [
        event('canvas', 'Lab', localIso(11, 15)),
        event('google', 'Coffee', localIso(11, 9)),
        event('canvas', 'Essay due', '2026-11-11', { end: '2026-11-12' }),
        event('canvas', 'Next week', localIso(20, 9)),
        event('google', 'Thursday', localIso(13, 10)),
      ],
    })
    expect(agenda.map((d) => d.date)).toEqual(['2026-11-11', '2026-11-13'])
    expect(agenda[0].items.map((i) => [i.title, i.time])).toEqual([
      ['Essay due', null],
      ['Coffee', '9:00 AM'],
      ['Lab', '3:00 PM'],
    ])
    expect(agenda[0].items[1].color).toBe('sky')
  })

  it('shows a multi-day all-day event on each of its days (end is exclusive)', () => {
    const agenda = buildAgenda({
      ...base,
      events: [event('canvas', 'Break', '2026-11-11', { end: '2026-11-13' })],
    })
    expect(agenda.map((d) => d.date)).toEqual(['2026-11-11', '2026-11-12'])
  })

  it('shows only the chosen calendars', () => {
    const agenda = buildAgenda({
      ...base,
      sourceIds: ['google'],
      events: [
        event('canvas', 'Lab', localIso(11, 15)),
        event('google', 'Coffee', localIso(11, 9)),
      ],
    })
    expect(agenda[0].items.map((i) => i.title)).toEqual(['Coffee'])
  })

  it('adds open tasks on their due day, and overdue ones under today', () => {
    const tasks = [
      task('Late', '2026-11-01'),
      task('Due tomorrow', '2026-11-12'),
      task('Done already', '2026-11-12', { done: true }),
      task('Far off', '2026-12-25'),
      task('Someday', null),
    ]
    const agenda = buildAgenda({ ...base, events: [], tasks })
    expect(agenda.map((d) => [d.date, d.items.map((i) => [i.title, i.overdue])])).toEqual([
      ['2026-11-11', [['Late', true]]],
      ['2026-11-12', [['Due tomorrow', false]]],
    ])
    expect(buildAgenda({ ...base, events: [], tasks, showTasks: false })).toEqual([])
  })
})

describe('dayHeading', () => {
  it('names today and tomorrow, and dates after that', () => {
    expect(dayHeading('2026-11-11', today)).toBe('Today')
    expect(dayHeading('2026-11-12', today)).toBe('Tomorrow')
    expect(dayHeading('2026-11-13', today)).toBe('Fri, Nov 13')
  })
})
