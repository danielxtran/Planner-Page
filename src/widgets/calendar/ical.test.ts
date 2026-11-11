import { describe, expect, it } from 'vitest'
import { parseIcs } from './ical'

// A small feed in the style Canvas sends: an all-day assignment, a timed
// event in UTC, and a weekly class in New York time with one week skipped
// (EXDATE) and one week moved (a second VEVENT with RECURRENCE-ID).
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:test',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:assignment-1',
  'DTSTART;VALUE=DATE:20261112',
  'DTEND;VALUE=DATE:20261113',
  'SUMMARY:Essay 2 [ENGL 1110]',
  'URL:https://school.instructure.com/courses/1/assignments/2',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:quiz-1',
  'DTSTART:20261113T235900Z',
  'DTEND:20261113T235900Z',
  'SUMMARY:Quiz 4',
  'LOCATION:Online',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:class-1',
  'DTSTART;TZID=America/New_York:20261102T093000',
  'DTEND;TZID=America/New_York:20261102T104500',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'EXDATE;TZID=America/New_York:20261109T093000',
  'SUMMARY:Chemistry lecture',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:class-1',
  'RECURRENCE-ID;TZID=America/New_York:20261116T093000',
  'DTSTART;TZID=America/New_York:20261117T140000',
  'DTEND;TZID=America/New_York:20261117T151500',
  'SUMMARY:Chemistry lecture (moved)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:old',
  'DTSTART:20250101T120000Z',
  'SUMMARY:Long ago',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const window = { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-12-01T00:00:00Z') }

describe('parseIcs', () => {
  const events = parseIcs(FEED, window.from, window.to)
  const titled = (title: string) => events.filter((e) => e.title === title)

  it('reads an all-day assignment with its link', () => {
    expect(titled('Essay 2 [ENGL 1110]')).toEqual([
      {
        title: 'Essay 2 [ENGL 1110]',
        start: '2026-11-12',
        end: '2026-11-13',
        allDay: true,
        location: null,
        url: 'https://school.instructure.com/courses/1/assignments/2',
      },
    ])
  })

  it('reads a timed event in UTC', () => {
    expect(titled('Quiz 4')[0]).toMatchObject({
      start: '2026-11-13T23:59:00.000Z',
      allDay: false,
      location: 'Online',
    })
  })

  it('expands a weekly event, converting its time zone, skipping and moving occurrences', () => {
    // Daylight saving ended on Nov 1, 2026, so New York is UTC-5: 9:30 there is 14:30 UTC.
    expect(titled('Chemistry lecture').map((e) => e.start)).toEqual([
      '2026-11-02T14:30:00.000Z',
      // Nov 9 is skipped (EXDATE); Nov 16 moved to Nov 17 below.
      '2026-11-23T14:30:00.000Z',
    ])
    expect(titled('Chemistry lecture (moved)').map((e) => e.start)).toEqual([
      '2026-11-17T19:00:00.000Z',
    ])
  })

  it('leaves out events outside the window and sorts the rest by start', () => {
    expect(titled('Long ago')).toEqual([])
    const starts = events.map((e) => e.start)
    expect(starts).toEqual([...starts].sort())
  })
})
