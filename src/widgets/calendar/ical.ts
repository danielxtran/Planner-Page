import ICAL from 'ical.js'
import type { NewCalendarEvent } from '../../storage/calendars'

/** Safety limit per repeating event, so a "daily forever" rule can't loop for ages. */
const MAX_STEPS = 5000

type Time = InstanceType<typeof ICAL.Time>
type IcalEvent = InstanceType<typeof ICAL.Event>

/**
 * Reads an iCalendar (.ics) file, like a Canvas feed, into events between
 * `from` and `to`. Repeating events are expanded into one event per
 * occurrence, using the ical.js library: repeat rules (RRULE), skipped dates,
 * moved occurrences, and time zones are fiddly enough that hand-written code
 * would get them wrong.
 */
export function parseIcs(text: string, from: Date, to: Date): NewCalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text))
  // Time zones defined inside the file must be registered before reading times.
  for (const zone of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(new ICAL.Timezone(zone))
  }

  const all = root.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v))
  // A moved or edited occurrence is its own VEVENT with a RECURRENCE-ID;
  // linking it to its series lets the expansion use the changed version.
  const series = new Map(all.filter((e) => !e.isRecurrenceException()).map((e) => [e.uid, e]))
  for (const exception of all.filter((e) => e.isRecurrenceException())) {
    series.get(exception.uid)?.relateException(exception)
  }

  const out: NewCalendarEvent[] = []
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const overlaps = (start: Time, end: Time | null) =>
    start.toJSDate().getTime() < toMs && (end ?? start).toJSDate().getTime() >= fromMs

  for (const event of series.values()) {
    if (!event.startDate) continue
    if (!event.isRecurring()) {
      if (overlaps(event.startDate, event.endDate))
        out.push(toEvent(event, event.startDate, event.endDate))
      continue
    }
    const iterator = event.iterator()
    for (let step = 0, next: Time | null; step < MAX_STEPS && (next = iterator.next()); step++) {
      if (next.toJSDate().getTime() >= toMs) break
      const details = event.getOccurrenceDetails(next)
      if (overlaps(details.startDate, details.endDate)) {
        out.push(toEvent(details.item, details.startDate, details.endDate))
      }
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

function toEvent(item: IcalEvent, start: Time, end: Time | null): NewCalendarEvent {
  const allDay = start.isDate
  const url = item.component.getFirstPropertyValue('url')
  return {
    title: item.summary?.trim() || '(no title)',
    start: format(start, allDay),
    end: end ? format(end, allDay) : null,
    allDay,
    location: item.location?.trim() || null,
    url: typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null,
  }
}

function format(time: Time, allDay: boolean): string {
  if (allDay) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${time.year}-${pad(time.month)}-${pad(time.day)}`
  }
  return time.toJSDate().toISOString()
}
