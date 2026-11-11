import { afterEach, describe, expect, it, vi } from 'vitest'
import { useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
import { listCalendarEvents, listCalendarSources } from '../../storage/calendars'
import { useCalendarStore } from './calendarStore'

const FEED = 'https://school.instructure.com/feeds/calendars/user_abc.ics'
const soon = new Date(Date.now() + 2 * 86_400_000)
const icsDate = `${soon.getUTCFullYear()}${String(soon.getUTCMonth() + 1).padStart(2, '0')}${String(soon.getUTCDate()).padStart(2, '0')}`
const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:a1',
  `DTSTART;VALUE=DATE:${icsDate}`,
  'SUMMARY:Problem set 3',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

/** Stands in for our /api/canvas-feed function. */
function stubProxy(response: () => Response) {
  const fetchMock = vi.fn(async () => response())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const store = () => useCalendarStore.getState()

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calendarStore', () => {
  it('adds a Canvas calendar with its events, as one undoable step', async () => {
    const fetchMock = stubProxy(() => new Response(ICS, { status: 200 }))
    await store().ensureLoaded()

    expect(await store().addCanvas('Classes', FEED)).toBe(true)

    // The feed link goes to our function in the body, not the URL.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/canvas-feed',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: FEED }) }),
    )
    expect(store().sources.map((s) => s.name)).toEqual(['Classes'])
    expect(store().events.map((e) => e.title)).toEqual(['Problem set 3'])
    expect(useUndoStore.getState().entries.map((e) => e.label)).toEqual(['connect Canvas calendar'])

    await useUndoStore.getState().undo()
    expect(store().sources).toEqual([])
    expect(await listCalendarEvents()).toEqual([])
  })

  it("doesn't save a feed link that fails", async () => {
    stubProxy(
      () =>
        new Response('Canvas refused that feed link.', {
          status: 502,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
    )
    await store().ensureLoaded()

    expect(await store().addCanvas('Classes', FEED)).toBe(false)
    expect(useErrorStore.getState().message).toMatch(/Canvas refused that feed link/)
    expect(await listCalendarSources()).toEqual([])
  })

  it('refuses something that is not a feed link before fetching', async () => {
    const fetchMock = stubProxy(() => new Response(ICS))
    await store().ensureLoaded()
    expect(await store().addCanvas('X', 'https://school.instructure.com/courses/1')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps old events and records the error when a refresh fails', async () => {
    stubProxy(() => new Response(ICS, { status: 200 }))
    await store().ensureLoaded()
    await store().addCanvas('Classes', FEED)
    const [source] = store().sources

    stubProxy(
      () => new Response('<html>', { status: 404, headers: { 'content-type': 'text/html' } }),
    )
    await store().sync(source.id, false)

    expect(store().events.map((e) => e.title)).toEqual(['Problem set 3'])
    expect(store().sources[0].lastError).toMatch(/calendar helper isn't running/)
    // A background refresh doesn't interrupt with the error banner.
    expect(useErrorStore.getState().message).toBeNull()
  })

  it('removes a calendar and undoes it', async () => {
    stubProxy(() => new Response(ICS, { status: 200 }))
    await store().ensureLoaded()
    await store().addCanvas('Classes', FEED)

    await store().remove(store().sources[0].id)
    expect(store().sources).toEqual([])
    expect(store().events).toEqual([])

    await useUndoStore.getState().undo()
    expect(store().sources.map((s) => s.name)).toEqual(['Classes'])
    expect(store().events.map((e) => e.title)).toEqual(['Problem set 3'])
  })
})
