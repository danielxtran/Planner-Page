import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { PASTEL_BG } from '../../theme/pastels'
import type { WidgetProps } from '../registry'
import { useTasks } from '../todo/useTasks'
import { WidgetCard } from '../WidgetCard'
import { buildAgenda, dayHeading } from './agenda'
import { readCalendarConfig, type CalendarConfig } from './calendarConfig'
import { CalendarSettings } from './CalendarSettings'
import { useCalendarStore } from './calendarStore'

const DEFAULT_TITLE = 'Calendar'

/**
 * An agenda of the next few days from connected calendars (Canvas, Google,
 * Outlook), with to-do tasks on their due dates. Read-only: events are
 * changed in their own apps; each one links there.
 */
export function CalendarWidget({ widget, onConfigChange }: WidgetProps) {
  const config = readCalendarConfig(widget.config)
  const { status, sources, events, syncing, ensureLoaded, sync } = useCalendarStore()
  const { tasks } = useTasks()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Re-read the clock every minute, so "Today" rolls over at midnight and
  // "updated 5 minutes ago" stays roughly right without a reload.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  function save(label: string, changes: Partial<CalendarConfig>) {
    onConfigChange(label, { ...widget.config, ...changes })
  }

  const shownSources = sources.filter(
    (s) => config.sourceIds === null || config.sourceIds.includes(s.id),
  )
  const agenda = buildAgenda({
    events,
    sources,
    tasks,
    sourceIds: config.sourceIds,
    days: config.days,
    showTasks: config.showTasks,
    today: now,
  })
  const busy = shownSources.some((s) => syncing.includes(s.id))
  const lastSynced = shownSources
    .map((s) => s.lastSyncedAt)
    .filter((t): t is string => t !== null)
    .sort()[0]
  const failing = shownSources.filter((s) => s.lastError)

  return (
    <WidgetCard
      title={config.title.trim() || DEFAULT_TITLE}
      defaultTitle={DEFAULT_TITLE}
      onRename={(title) => save('rename widget', { title })}
      tape="sky"
      aside={
        <div className="flex flex-wrap items-center justify-end gap-1">
          {shownSources.length > 0 && (
            <button
              type="button"
              disabled={busy}
              // A click, so Google may open its sign-in popup if its hour is up.
              onClick={() => shownSources.forEach((s) => void sync(s.id, true))}
              className="rounded-full border border-ink/25 bg-paper px-2.5 py-0.5 hover:bg-butter disabled:opacity-60"
            >
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          <button
            type="button"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
            className="rounded-full border border-ink/25 bg-paper px-2.5 py-0.5 hover:bg-butter"
          >
            Calendars
          </button>
        </div>
      }
    >
      {settingsOpen && (
        <CalendarSettings
          config={config}
          onChange={(label, changes) => save(label, changes)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {status !== 'ready' && status !== 'error' ? (
        <p className="text-ink-soft">Loading…</p>
      ) : sources.length === 0 && !settingsOpen ? (
        <div className="rounded-sm border-2 border-dashed border-ink/20 p-4 text-center">
          <p className="font-hand text-2xl text-ink-soft">No calendars yet.</p>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="mt-2 rounded-full bg-butter px-3 py-1 text-sm hover:bg-butter/70"
          >
            Connect Canvas, Google, or Outlook
          </button>
        </div>
      ) : agenda.length === 0 ? (
        <p className="mt-2 font-hand text-2xl text-ink-soft">
          Nothing in the next {config.days} days.
        </p>
      ) : (
        <ol className="mt-1 space-y-3">
          {agenda.map((day) => (
            <li key={day.date}>
              <h3 className="border-b border-dashed border-ink/20 font-hand text-2xl font-bold">
                {dayHeading(day.date, now)}
              </h3>
              <ul className="mt-1 space-y-1">
                {day.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-2 text-sm">
                    {item.kind === 'task' ? (
                      <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center text-ink-soft">
                        ☐
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full border border-ink/30 ${item.color ? PASTEL_BG[item.color] : ''}`}
                      />
                    )}
                    {/* Narrow widget: time sits above the title. Wider than 18rem: in its own column. */}
                    <span className="flex min-w-0 flex-1 flex-col @2xs:flex-row @2xs:gap-2">
                      <span className="shrink-0 text-xs text-ink-soft @2xs:w-16 @2xs:text-sm">
                        {item.time ?? (item.kind === 'task' ? 'Task' : 'All day')}
                      </span>
                      <span className="min-w-0 flex-1 wrap-anywhere">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-dashed underline-offset-4 hover:decoration-solid"
                          >
                            {item.title}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          item.title
                        )}
                        {item.overdue && (
                          <span className="ml-1.5 rounded-full bg-rose px-1.5 text-xs">
                            overdue
                          </span>
                        )}
                        {item.location && (
                          <span className="block text-xs text-ink-soft">{item.location}</span>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {(lastSynced || failing.length > 0) && (
        <div className="mt-3 space-y-0.5 text-xs text-ink-soft">
          {failing.map((s) => (
            <p key={s.id}>
              <span aria-hidden>⚠ </span>
              {s.name}: {s.lastError}
            </p>
          ))}
          {lastSynced && (
            <p>Updated {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}</p>
          )}
        </div>
      )}
    </WidgetCard>
  )
}
