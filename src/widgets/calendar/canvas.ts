import type { NewCalendarEvent } from '../../storage/calendars'
import { parseIcs } from './ical'
import { syncWindow } from './syncWindow'

/**
 * A quick check before sending a link anywhere. The server function checks
 * again, more strictly; this one just gives a friendly message sooner.
 */
export function looksLikeCanvasFeed(input: string): boolean {
  try {
    const url = new URL(input.trim())
    return url.protocol === 'https:' && /^\/feeds\/calendars\/[\w.-]+\.ics$/i.test(url.pathname)
  } catch {
    return false
  }
}

/** Fetches a Canvas feed through our proxy function and reads its events. */
export async function fetchCanvasEvents(feedUrl: string): Promise<NewCalendarEvent[]> {
  const response = await fetch('/api/canvas-feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: feedUrl }),
  })
  const text = await response.text()
  if (!response.ok) {
    // The function answers with a readable sentence; a missing function gives HTML.
    throw new Error(
      response.headers.get('content-type')?.startsWith('text/plain')
        ? text
        : "The calendar helper isn't running here (see docs/calendar-setup.md)",
    )
  }
  const { from, to } = syncWindow()
  return parseIcs(text, from, to)
}
