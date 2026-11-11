import { create } from 'zustand'
import { messageOf, useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
import {
  addCalendarSource,
  listCalendarEvents,
  listCalendarSources,
  removeCalendarSource,
  replaceCalendarEvents,
  restoreCalendarSource,
  updateCalendarSource,
  type CalendarEvent,
  type CalendarSource,
  type NewCalendarEvent,
} from '../../storage/calendars'
import { CATEGORY_COLORS, type CategoryColor } from '../../storage/categories'
import { fetchCanvasEvents, looksLikeCanvasFeed } from './canvas'
import { fetchGoogleEvents, getGoogleToken } from './google'
import { fetchOutlookEvents, getOutlookToken, signInToOutlook, signOutOfOutlook } from './outlook'

/** A Canvas calendar older than this refreshes on its own when the hub opens. */
const STALE_AFTER_MS = 30 * 60 * 1000

interface CalendarData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  sources: CalendarSource[]
  events: CalendarEvent[]
  /** Ids of calendars being synced right now. */
  syncing: string[]
  /** Which kind of calendar is mid-connect ('canvas' while checking a feed link), if any. */
  connecting: CalendarSource['kind'] | null
}

interface CalendarActions {
  ensureLoaded: () => Promise<void>
  /** `true` if it worked; failures show in the hub's error banner. */
  addCanvas: (name: string, feedUrl: string) => Promise<boolean>
  connectGoogle: () => Promise<boolean>
  connectOutlook: () => Promise<boolean>
  /**
   * Fetches fresh events. `interactive` means it came from a click, so a
   * sign-in popup is allowed if one is needed.
   */
  sync: (sourceId: string, interactive: boolean) => Promise<void>
  remove: (sourceId: string) => Promise<void>
}

export const initialCalendarState: CalendarData = {
  status: 'idle',
  sources: [],
  events: [],
  syncing: [],
  connecting: null,
}

export const useCalendarStore = create<CalendarData & CalendarActions>()((set, get) => {
  const report = (e: unknown, prefix: string) => useErrorStore.getState().report(e, prefix)

  async function reload() {
    const [sources, events] = await Promise.all([listCalendarSources(), listCalendarEvents()])
    set({ sources, events })
  }

  /** The next pastel not used by another calendar, so new ones are easy to tell apart. */
  function nextColor(): CategoryColor {
    const used = new Set(get().sources.map((s) => s.color))
    return (
      CATEGORY_COLORS.find((c) => !used.has(c)) ??
      CATEGORY_COLORS[get().sources.length % CATEGORY_COLORS.length]
    )
  }

  /** Saves a newly connected calendar with its first events, as one undoable step. */
  async function saveNew(
    source: Parameters<typeof addCalendarSource>[0],
    events: NewCalendarEvent[],
    label: string,
  ) {
    const added = await addCalendarSource(source)
    await replaceCalendarEvents(added.id, events)
    await reload()
    useUndoStore.getState().push({
      label,
      undo: async () => {
        await removeCalendarSource(added.id)
        await reload()
      },
    })
  }

  async function fetchFor(
    source: CalendarSource,
    interactive: boolean,
  ): Promise<NewCalendarEvent[]> {
    switch (source.kind) {
      case 'canvas':
        return fetchCanvasEvents(source.feedUrl ?? '')
      case 'google': {
        const token = await getGoogleToken({ account: source.account ?? undefined })
        return (await fetchGoogleEvents(token)).events
      }
      case 'outlook': {
        const token = await getOutlookToken(source.account ?? '', interactive)
        return fetchOutlookEvents(token)
      }
    }
  }

  return {
    ...initialCalendarState,

    ensureLoaded: async () => {
      if (get().status !== 'idle') return
      set({ status: 'loading' })
      try {
        await reload()
        set({ status: 'ready' })
      } catch (e) {
        set({ status: 'error' })
        report(e, "Couldn't load your calendars: ")
        return
      }
      // Refresh in the background what can refresh without a click. Google
      // can't: its browser sign-in needs a popup, which needs a click.
      const now = Date.now()
      for (const source of get().sources) {
        const stale = !source.lastSyncedAt || now - Date.parse(source.lastSyncedAt) > STALE_AFTER_MS
        if (stale && source.kind !== 'google') void get().sync(source.id, false)
      }
    },

    addCanvas: async (name, feedUrl) => {
      const url = feedUrl.trim()
      if (!looksLikeCanvasFeed(url)) {
        report(
          new Error(
            "That doesn't look like a Canvas feed link. In Canvas: Calendar > Calendar Feed.",
          ),
          '',
        )
        return false
      }
      set({ connecting: 'canvas' })
      useErrorStore.getState().clear()
      try {
        // Fetch first: a link that doesn't work is never saved.
        const events = await fetchCanvasEvents(url)
        await saveNew(
          { kind: 'canvas', name: name.trim() || 'Canvas', color: nextColor(), feedUrl: url },
          events,
          'connect Canvas calendar',
        )
        return true
      } catch (e) {
        report(e, "Couldn't add the Canvas calendar: ")
        return false
      } finally {
        set({ connecting: null })
      }
    },

    connectGoogle: async () => {
      set({ connecting: 'google' })
      useErrorStore.getState().clear()
      try {
        const token = await getGoogleToken({ fresh: true })
        const { account, events } = await fetchGoogleEvents(token)
        if (account && get().sources.some((s) => s.kind === 'google' && s.account === account)) {
          throw new Error(`${account} is already connected`)
        }
        await saveNew(
          { kind: 'google', name: 'Google Calendar', color: nextColor(), account },
          events,
          'connect Google Calendar',
        )
        return true
      } catch (e) {
        report(e, "Couldn't connect Google Calendar: ")
        return false
      } finally {
        set({ connecting: null })
      }
    },

    connectOutlook: async () => {
      set({ connecting: 'outlook' })
      useErrorStore.getState().clear()
      try {
        const account = await signInToOutlook()
        if (get().sources.some((s) => s.kind === 'outlook' && s.account === account)) {
          throw new Error(`${account} is already connected`)
        }
        const events = await fetchOutlookEvents(await getOutlookToken(account, true))
        await saveNew(
          { kind: 'outlook', name: 'Outlook', color: nextColor(), account },
          events,
          'connect Outlook calendar',
        )
        return true
      } catch (e) {
        report(e, "Couldn't connect Outlook: ")
        return false
      } finally {
        set({ connecting: null })
      }
    },

    sync: async (sourceId, interactive) => {
      const source = get().sources.find((s) => s.id === sourceId)
      if (!source || get().syncing.includes(sourceId)) return
      set({ syncing: [...get().syncing, sourceId] })
      try {
        const events = await fetchFor(source, interactive)
        await replaceCalendarEvents(sourceId, events)
      } catch (e) {
        // The error is shown beside that calendar; old events stay visible meanwhile.
        await updateCalendarSource(sourceId, { lastError: messageOf(e) }).catch(() => {})
        if (interactive) report(e, `Couldn't refresh ${source.name}: `)
      } finally {
        set({ syncing: get().syncing.filter((id) => id !== sourceId) })
        await reload().catch((e: unknown) => report(e, "Couldn't load your calendars: "))
      }
    },

    remove: async (sourceId) => {
      useErrorStore.getState().clear()
      try {
        const removed = await removeCalendarSource(sourceId)
        await reload()
        useUndoStore.getState().push({
          label: `remove ${removed.source.name}`,
          // Undo brings back the calendar and its cached events. For Outlook,
          // Refresh may ask you to sign in again, since removing it signed you out here.
          undo: async () => {
            await restoreCalendarSource(removed)
            await reload()
          },
        })
        if (removed.source.kind === 'outlook' && removed.source.account) {
          void signOutOfOutlook(removed.source.account).catch(() => {})
        }
      } catch (e) {
        report(e, "Couldn't remove the calendar: ")
      }
    },
  }
})
