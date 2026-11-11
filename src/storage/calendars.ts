import type { CategoryColor } from './categories'
import { db } from './db'
import { LOCAL_USER_ID } from './user'

export type CalendarKind = 'canvas' | 'google' | 'outlook'

/** A connected calendar. Shared by every calendar widget; each widget picks which to show. */
export interface CalendarSource {
  id: string
  userId: string
  kind: CalendarKind
  name: string
  color: CategoryColor
  /**
   * Canvas only: the private feed link. Anyone with it can read the calendar,
   * so it stays in this browser's storage and is never put in the code or logs.
   */
  feedUrl: string | null
  /** Google/Outlook: which account it is (an email), to tell accounts apart. Shown, not used to sign in. */
  account: string | null
  lastSyncedAt: string | null
  /** The last sync's error message, cleared by the next good sync. */
  lastError: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A cached copy of one event (or one occurrence of a repeating event). The
 * hub never changes calendars; it keeps copies so it shows events instantly,
 * offline, and without signing in again on every visit.
 */
export interface CalendarEvent {
  id: string
  userId: string
  sourceId: string
  title: string
  /** All-day: 'yyyy-MM-dd'. Timed: a full ISO time in UTC. */
  start: string
  /** Same format as start. All-day ends are exclusive (the day after the last day), as in iCal. */
  end: string | null
  allDay: boolean
  location: string | null
  /** Link to the event or assignment in its own app. */
  url: string | null
  createdAt: string
  updatedAt: string
}

/** What a sync hands over for one event; storage fills in ids and timestamps. */
export type NewCalendarEvent = Pick<
  CalendarEvent,
  'title' | 'start' | 'end' | 'allDay' | 'location' | 'url'
>

export interface NewCalendarSource {
  kind: CalendarKind
  name: string
  color: CategoryColor
  feedUrl?: string | null
  account?: string | null
}

const mine = <T extends { userId: string }>(rows: T[]) =>
  rows.filter((r) => r.userId === LOCAL_USER_ID)

export async function listCalendarSources(): Promise<CalendarSource[]> {
  return mine(await db.calendarSources.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt'))
}

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  return mine(await db.calendarEvents.where('userId').equals(LOCAL_USER_ID).sortBy('start'))
}

export async function addCalendarSource(input: NewCalendarSource): Promise<CalendarSource> {
  const name = input.name.trim()
  if (!name) throw new Error('Give the calendar a name')
  if (input.kind === 'canvas' && !input.feedUrl)
    throw new Error('A Canvas calendar needs its feed link')
  const now = new Date().toISOString()
  const source: CalendarSource = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER_ID,
    kind: input.kind,
    name,
    color: input.color,
    feedUrl: input.feedUrl ?? null,
    account: input.account ?? null,
    lastSyncedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.calendarSources.add(source)
  return source
}

export async function updateCalendarSource(
  id: string,
  changes: Partial<Pick<CalendarSource, 'name' | 'color' | 'account' | 'lastError'>>,
): Promise<CalendarSource> {
  if (changes.name !== undefined && !changes.name.trim())
    throw new Error('Give the calendar a name')
  return db.transaction('rw', db.calendarSources, async () => {
    const source = await db.calendarSources.get(id)
    if (!source || source.userId !== LOCAL_USER_ID) throw new Error(`Calendar not found: ${id}`)
    const updated = { ...source, ...changes, updatedAt: new Date().toISOString() }
    await db.calendarSources.put(updated)
    return updated
  })
}

/** Everything a removal took away, so undo can put it back exactly. */
export interface RemovedCalendar {
  source: CalendarSource
  events: CalendarEvent[]
}

export async function removeCalendarSource(id: string): Promise<RemovedCalendar> {
  return db.transaction('rw', db.calendarSources, db.calendarEvents, async () => {
    const source = await db.calendarSources.get(id)
    if (!source || source.userId !== LOCAL_USER_ID) throw new Error(`Calendar not found: ${id}`)
    const events = await db.calendarEvents.where('sourceId').equals(id).toArray()
    await db.calendarEvents.where('sourceId').equals(id).delete()
    await db.calendarSources.delete(id)
    return { source, events }
  })
}

export async function restoreCalendarSource(removed: RemovedCalendar): Promise<void> {
  await db.transaction('rw', db.calendarSources, db.calendarEvents, async () => {
    await db.calendarSources.put(removed.source)
    await db.calendarEvents.bulkPut(removed.events)
  })
}

/**
 * Swaps a calendar's cached events for a fresh copy, all at once: a sync never
 * leaves half old and half new events behind, even if the browser closes mid-save.
 */
export async function replaceCalendarEvents(
  sourceId: string,
  events: NewCalendarEvent[],
): Promise<CalendarSource> {
  for (const e of events) assertValidEvent(e)
  return db.transaction('rw', db.calendarSources, db.calendarEvents, async () => {
    const source = await db.calendarSources.get(sourceId)
    if (!source || source.userId !== LOCAL_USER_ID)
      throw new Error(`Calendar not found: ${sourceId}`)
    const now = new Date().toISOString()
    await db.calendarEvents.where('sourceId').equals(sourceId).delete()
    await db.calendarEvents.bulkAdd(
      events.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        userId: LOCAL_USER_ID,
        sourceId,
        createdAt: now,
        updatedAt: now,
      })),
    )
    const updated = { ...source, lastSyncedAt: now, lastError: null, updatedAt: now }
    await db.calendarSources.put(updated)
    return updated
  })
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function assertValidEvent(e: NewCalendarEvent) {
  const valid = (value: string) =>
    e.allDay ? DATE_ONLY.test(value) : !Number.isNaN(Date.parse(value)) && value.includes('T')
  if (typeof e.title !== 'string') throw new Error('Event title must be text')
  if (!valid(e.start)) throw new Error(`Bad event start: ${e.start}`)
  if (e.end !== null && !valid(e.end)) throw new Error(`Bad event end: ${e.end}`)
}
