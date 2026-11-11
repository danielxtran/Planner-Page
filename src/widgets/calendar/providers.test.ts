import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleEvents } from './google'
import { fetchOutlookEvents } from './outlook'

/** Answers each request by matching part of its URL. */
function stubApi(routes: [string, unknown][]) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const match = routes.find(([part]) => url.includes(part))
    return match
      ? new Response(JSON.stringify(match[1]), { status: 200 })
      : new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchGoogleEvents', () => {
  it('reads shown calendars, skips cancelled events, and names the account', async () => {
    const fetchMock = stubApi([
      [
        'calendarList',
        {
          items: [
            { id: 'me@gmail.com', primary: true },
            { id: 'club@group.calendar.google.com', selected: true },
            { id: 'hidden@group.calendar.google.com', selected: false },
          ],
        },
      ],
      [
        encodeURIComponent('me@gmail.com'),
        {
          items: [
            {
              summary: 'Dentist',
              location: 'Main St',
              htmlLink: 'https://calendar.google.com/event?eid=1',
              start: { dateTime: '2026-11-12T09:00:00-05:00' },
              end: { dateTime: '2026-11-12T10:00:00-05:00' },
            },
            { status: 'cancelled', summary: 'Gone', start: { date: '2026-11-13' } },
          ],
        },
      ],
      [
        encodeURIComponent('club@group.calendar.google.com'),
        {
          items: [
            { summary: 'Club fair', start: { date: '2026-11-14' }, end: { date: '2026-11-15' } },
          ],
        },
      ],
    ])

    const { account, events } = await fetchGoogleEvents('token-1')

    expect(account).toBe('me@gmail.com')
    expect(events).toEqual([
      {
        title: 'Dentist',
        start: '2026-11-12T14:00:00.000Z',
        end: '2026-11-12T15:00:00.000Z',
        allDay: false,
        location: 'Main St',
        url: 'https://calendar.google.com/event?eid=1',
      },
      {
        title: 'Club fair',
        start: '2026-11-14',
        end: '2026-11-15',
        allDay: true,
        location: null,
        url: null,
      },
    ])
    // Two calendars read (the hidden one isn't), each asking Google to expand repeats.
    const eventCalls = fetchMock.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/events?'))
    expect(eventCalls).toHaveLength(2)
    expect(eventCalls[0]).toContain('singleEvents=true')
    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer token-1' } })
  })
})

describe('fetchOutlookEvents', () => {
  it('reads Graph events in UTC and follows the next page', async () => {
    stubApi([
      [
        'page=2',
        { value: [{ subject: 'Standup', start: { dateTime: '2026-11-13T15:00:00.0000000' } }] },
      ],
      [
        'calendarView',
        {
          value: [
            {
              subject: 'Holiday',
              isAllDay: true,
              start: { dateTime: '2026-11-26T00:00:00.0000000' },
              end: { dateTime: '2026-11-27T00:00:00.0000000' },
            },
            {
              subject: 'Cancelled',
              isCancelled: true,
              start: { dateTime: '2026-11-12T10:00:00.0000000' },
            },
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?page=2',
        },
      ],
    ])

    const events = await fetchOutlookEvents('token-2')

    expect(events.map((e) => [e.title, e.start, e.allDay])).toEqual([
      ['Holiday', '2026-11-26', true],
      ['Standup', '2026-11-13T15:00:00.000Z', false],
    ])
  })
})
