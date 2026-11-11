import type { NewCalendarEvent } from '../../storage/calendars'
import { syncWindow } from './syncWindow'

/**
 * Google Calendar, read-only, entirely in the browser:
 * - Google Identity Services (GIS) shows Google's own sign-in popup and hands
 *   back a short-lived access token. The app never sees a password.
 * - The token (valid about an hour) is kept in sessionStorage, so a refresh
 *   within the hour doesn't ask again; it's gone when the tab closes.
 * - With that token, the app reads events from the Calendar API directly.
 */

/** The app's public Google client ID from .env.local, or null if Google isn't set up. */
export const googleClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || null

// Read-only access to calendars and their events. Nothing broader.
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_KEY = 'planner-hub:google-token'

// The small part of the GIS library this file uses.
interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (options?: { prompt?: string; login_hint?: string }) => void
}
interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (response: TokenResponse) => void
      error_callback?: (error: { type: string; message?: string }) => void
    }) => TokenClient
  }
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

let gisScript: Promise<GoogleAccounts> | null = null

/** Loads Google's sign-in script the first time it's needed (not on every page load). */
function loadGis(): Promise<GoogleAccounts> {
  gisScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () =>
      window.google
        ? resolve(window.google.accounts)
        : reject(new Error('Google sign-in failed to load'))
    script.onerror = () => {
      gisScript = null
      reject(new Error("Couldn't load Google sign-in. Check your connection or ad blocker."))
    }
    document.head.append(script)
  })
  return gisScript
}

function savedToken(): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as {
      value: string
      expiresAt: number
    } | null
    // A minute of margin, so a token doesn't expire halfway through a sync.
    return saved && saved.expiresAt - 60_000 > Date.now() ? saved.value : null
  } catch {
    return null
  }
}

/**
 * An access token, from this tab's saved one or by asking Google. Asking opens
 * a popup, which browsers only allow right after a click, so call this from a
 * click handler. `fresh` forces Google's account chooser (for connecting).
 */
export async function getGoogleToken({
  fresh = false,
  account,
}: { fresh?: boolean; account?: string } = {}) {
  const clientId = googleClientId()
  if (!clientId) throw new Error('Google Calendar is not set up yet (see docs/calendar-setup.md)')
  if (!fresh) {
    const saved = savedToken()
    if (saved) return saved
  }
  const accounts = await loadGis()
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: resolve,
      error_callback: (error) =>
        reject(
          new Error(
            error.type === 'popup_closed' ? 'Google sign-in was closed' : 'Google sign-in failed',
          ),
        ),
    })
    client.requestAccessToken({ prompt: fresh ? 'select_account' : '', login_hint: account })
  })
  if (!response.access_token) {
    throw new Error(response.error_description || response.error || 'Google did not give access')
  }
  try {
    sessionStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({
        value: response.access_token,
        expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
      }),
    )
  } catch {
    // Storage blocked (private mode): the token still works for this sync.
  }
  return response.access_token
}

export function forgetGoogleToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing saved, nothing to forget.
  }
}

interface GoogleCalendar {
  id: string
  primary?: boolean
  selected?: boolean
}
interface GoogleEvent {
  status?: string
  summary?: string
  location?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

async function call<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (response.status === 401) {
    forgetGoogleToken()
    throw new Error('Google sign-in expired. Press Refresh to sign in again.')
  }
  if (!response.ok) throw new Error(`Google Calendar answered with an error (${response.status})`)
  return (await response.json()) as T
}

/**
 * Events from every calendar shown in the user's Google Calendar (the checked
 * ones in its sidebar). `account` is the primary calendar's id, which is the
 * account's email address.
 */
export async function fetchGoogleEvents(token: string) {
  const { from, to } = syncWindow()
  const list = await call<{ items?: GoogleCalendar[] }>(
    token,
    '/users/me/calendarList?minAccessRole=reader',
  )
  const calendars = (list.items ?? []).filter((c) => c.selected || c.primary)
  const account = calendars.find((c) => c.primary)?.id ?? null

  const events: NewCalendarEvent[] = []
  for (const calendar of calendars) {
    let pageToken: string | undefined
    // Pages of up to 250 events; a few pages at most for a 4-month window.
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        // Expand repeating events into single occurrences server-side.
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      })
      if (pageToken) query.set('pageToken', pageToken)
      const result = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(
        token,
        `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`,
      )
      for (const item of result.items ?? []) {
        const event = toEvent(item)
        if (event) events.push(event)
      }
      pageToken = result.nextPageToken
      if (!pageToken) break
    }
  }
  return { account, events }
}

function toEvent(item: GoogleEvent): NewCalendarEvent | null {
  if (item.status === 'cancelled' || !item.start) return null
  const allDay = Boolean(item.start.date)
  const start = allDay ? item.start.date : item.start.dateTime
  if (!start) return null
  const end = allDay ? item.end?.date : item.end?.dateTime
  return {
    title: item.summary?.trim() || '(no title)',
    start: allDay ? start : new Date(start).toISOString(),
    end: end ? (allDay ? end : new Date(end).toISOString()) : null,
    allDay,
    location: item.location?.trim() || null,
    url: item.htmlLink ?? null,
  }
}
