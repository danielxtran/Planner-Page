import type { AccountInfo, PublicClientApplication } from '@azure/msal-browser'
import type { NewCalendarEvent } from '../../storage/calendars'
import { syncWindow } from './syncWindow'

/**
 * Outlook calendars, read-only, through Microsoft Graph. MSAL.js (Microsoft's
 * sign-in library) shows Microsoft's own sign-in popup. Unlike Google's
 * browser flow, MSAL can quietly renew access afterwards, so Outlook calendars
 * can refresh on page load without a popup.
 */

/** The app's public Microsoft client ID from .env.local, or null if Outlook isn't set up. */
export const microsoftClientId = () => import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim() || null

// Read-only calendar access. User.Read is what lets sign-in show who you are.
const SCOPES = ['Calendars.Read', 'User.Read']

let app: Promise<PublicClientApplication> | null = null

/** MSAL is a big library, so it's downloaded only once someone uses Outlook. */
function getApp(): Promise<PublicClientApplication> {
  const clientId = microsoftClientId()
  if (!clientId) {
    return Promise.reject(new Error('Outlook is not set up yet (see docs/calendar-setup.md)'))
  }
  app ??= import('@azure/msal-browser').then(async ({ PublicClientApplication }) => {
    const instance = new PublicClientApplication({
      auth: {
        clientId,
        // "common" accepts both personal Microsoft accounts and work/school ones.
        authority: 'https://login.microsoftonline.com/common',
        // A blank page for the popup to land on (public/auth-redirect.html).
        redirectUri: `${window.location.origin}/auth-redirect.html`,
      },
      // Remembered across visits so Outlook can refresh without signing in each
      // time. The trade-off: anything able to run script on this page could read
      // it, which is why the page loads no third-party scripts besides sign-in.
      cache: { cacheLocation: 'localStorage' },
    })
    await instance.initialize()
    return instance
  })
  return app
}

/** Opens Microsoft's sign-in popup. Call from a click. Returns the account's email. */
export async function signInToOutlook(): Promise<string> {
  const msal = await getApp()
  const result = await msal.loginPopup({ scopes: SCOPES, prompt: 'select_account' })
  return result.account.username
}

/**
 * An access token for an account that signed in before. With `interactive`
 * (only from a click), it may open a popup if Microsoft needs you to sign in again.
 */
export async function getOutlookToken(username: string, interactive: boolean): Promise<string> {
  const msal = await getApp()
  const account: AccountInfo | null = msal.getAccount({ username })
  try {
    if (!account) throw new Error('not signed in')
    return (await msal.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
  } catch (e) {
    if (!interactive)
      throw new Error('Outlook sign-in expired. Press Refresh to sign in again.', { cause: e })
    return (await msal.acquireTokenPopup({ scopes: SCOPES, loginHint: username })).accessToken
  }
}

export async function signOutOfOutlook(username: string) {
  const msal = await getApp()
  const account = msal.getAccount({ username })
  // Clears this app's saved sign-in only; it doesn't sign you out of Microsoft everywhere.
  if (account) await msal.clearCache({ account })
}

interface GraphEvent {
  subject?: string
  isAllDay?: boolean
  isCancelled?: boolean
  webLink?: string
  location?: { displayName?: string }
  start?: { dateTime?: string }
  end?: { dateTime?: string }
}

/** Events in the account's main calendar, with repeating events already expanded by Graph. */
export async function fetchOutlookEvents(token: string): Promise<NewCalendarEvent[]> {
  const { from, to } = syncWindow()
  const query = new URLSearchParams({
    startDateTime: from.toISOString(),
    endDateTime: to.toISOString(),
    $select: 'subject,start,end,isAllDay,isCancelled,location,webLink',
    $top: '200',
  })
  let next: string | undefined = `https://graph.microsoft.com/v1.0/me/calendarView?${query}`
  const events: NewCalendarEvent[] = []
  for (let page = 0; next && page < 20; page++) {
    const response = await fetch(next, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Ask for every time in UTC, so they convert cleanly to the viewer's zone.
        Prefer: 'outlook.timezone="UTC"',
      },
    })
    if (!response.ok) throw new Error(`Outlook answered with an error (${response.status})`)
    const body = (await response.json()) as { value?: GraphEvent[]; '@odata.nextLink'?: string }
    for (const item of body.value ?? []) {
      const event = toEvent(item)
      if (event) events.push(event)
    }
    next = body['@odata.nextLink']
  }
  return events
}

function toEvent(item: GraphEvent): NewCalendarEvent | null {
  const start = item.start?.dateTime
  if (item.isCancelled || !start) return null
  const end = item.end?.dateTime
  // Graph's times look like "2026-11-12T15:00:00.0000000" with the zone given separately.
  const utc = (value: string) => new Date(`${value.slice(0, 19)}Z`).toISOString()
  return {
    title: item.subject?.trim() || '(no title)',
    start: item.isAllDay ? start.slice(0, 10) : utc(start),
    end: end ? (item.isAllDay ? end.slice(0, 10) : utc(end)) : null,
    allDay: Boolean(item.isAllDay),
    location: item.location?.displayName?.trim() || null,
    url: item.webLink ?? null,
  }
}
