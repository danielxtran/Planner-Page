import { describe, expect, it } from 'vitest'
import {
  addCalendarSource,
  listCalendarEvents,
  listCalendarSources,
  removeCalendarSource,
  replaceCalendarEvents,
  restoreCalendarSource,
  type NewCalendarEvent,
} from './calendars'

const canvas = () =>
  addCalendarSource({
    kind: 'canvas',
    name: 'Canvas',
    color: 'peach',
    feedUrl: 'https://x.instructure.com/feeds/calendars/user_a.ics',
  })

const event = (title: string, start = '2026-11-12'): NewCalendarEvent => ({
  title,
  start,
  end: null,
  allDay: !start.includes('T'),
  location: null,
  url: null,
})

describe('calendar storage', () => {
  it('adds a source and requires a name and, for Canvas, a feed link', async () => {
    const source = await canvas()
    expect(source).toMatchObject({ kind: 'canvas', lastSyncedAt: null, lastError: null })
    expect(await listCalendarSources()).toEqual([source])
    await expect(addCalendarSource({ kind: 'canvas', name: 'X', color: 'mint' })).rejects.toThrow(
      'feed link',
    )
    await expect(addCalendarSource({ kind: 'google', name: ' ', color: 'mint' })).rejects.toThrow(
      'name',
    )
  })

  it('replaces only that calendar’s events and marks it synced', async () => {
    const a = await canvas()
    const b = await canvas()
    await replaceCalendarEvents(a.id, [event('Old A')])
    await replaceCalendarEvents(b.id, [event('B')])

    const synced = await replaceCalendarEvents(a.id, [
      event('New A'),
      event('Timed', '2026-11-12T15:00:00.000Z'),
    ])

    expect(synced.lastSyncedAt).not.toBeNull()
    expect((await listCalendarEvents()).map((e) => e.title).sort()).toEqual(['B', 'New A', 'Timed'])
  })

  it('rejects a malformed event without changing anything', async () => {
    const a = await canvas()
    await replaceCalendarEvents(a.id, [event('Keep')])
    await expect(replaceCalendarEvents(a.id, [event('Bad', 'next tuesday')])).rejects.toThrow(
      'Bad event start',
    )
    expect((await listCalendarEvents()).map((e) => e.title)).toEqual(['Keep'])
  })

  it('removes a calendar with its events, and restores both exactly', async () => {
    const a = await canvas()
    await replaceCalendarEvents(a.id, [event('Essay')])
    const before = { sources: await listCalendarSources(), events: await listCalendarEvents() }

    const removed = await removeCalendarSource(a.id)
    expect(await listCalendarSources()).toEqual([])
    expect(await listCalendarEvents()).toEqual([])

    await restoreCalendarSource(removed)
    expect(await listCalendarSources()).toEqual(before.sources)
    expect(await listCalendarEvents()).toEqual(before.events)
  })
})
