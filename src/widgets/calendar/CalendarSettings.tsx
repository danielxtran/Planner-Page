import { formatDistanceToNow } from 'date-fns'
import { useId, useState, type FormEvent } from 'react'
import type { CalendarSource } from '../../storage/calendars'
import { PASTEL_BG } from '../../theme/pastels'
import { ChoiceButton, OptionRow, StylePanel } from '../StylePanel'
import { DAY_CHOICES, type CalendarConfig } from './calendarConfig'
import { useCalendarStore } from './calendarStore'
import { googleClientId } from './google'
import { microsoftClientId } from './outlook'

const KIND_LABEL: Record<CalendarSource['kind'], string> = {
  canvas: 'Canvas',
  google: 'Google',
  outlook: 'Outlook',
}

interface CalendarSettingsProps {
  config: CalendarConfig
  onChange: (label: string, changes: Partial<CalendarConfig>) => void
  onClose: () => void
}

/**
 * Connected calendars (shared by every calendar widget) plus this widget's
 * own choices: which calendars to show, how many days, and whether to show tasks.
 */
export function CalendarSettings({ config, onChange, onClose }: CalendarSettingsProps) {
  const { sources, syncing, connecting, sync, remove, connectGoogle, connectOutlook } =
    useCalendarStore()
  const googleReady = Boolean(googleClientId())
  const outlookReady = Boolean(microsoftClientId())

  function toggleShown(id: string) {
    const current = config.sourceIds ?? sources.map((s) => s.id)
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    // Back to "all" when everything is ticked, so calendars connected later show up too.
    const all = sources.every((s) => next.includes(s.id))
    onChange('choose calendars', { sourceIds: all ? null : next })
  }

  return (
    <StylePanel label="Calendar settings" onClose={onClose}>
      <div>
        <p className="mb-1 text-ink-soft">Connected calendars</p>
        {sources.length === 0 ? (
          <p className="text-ink-soft">None yet. Add one below.</p>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((source) => {
              const shown = config.sourceIds === null || config.sourceIds.includes(source.id)
              return (
                <li key={source.id} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={() => toggleShown(source.id)}
                      className="size-4 accent-(--color-ink-soft)"
                    />
                    <span
                      aria-hidden
                      className={`size-3 shrink-0 rounded-full border border-ink/30 ${PASTEL_BG[source.color]}`}
                    />
                    <span className="min-w-0 break-words">
                      {source.name}
                      <span className="text-ink-soft">
                        {' '}
                        · {KIND_LABEL[source.kind]}
                        {source.account && ` · ${source.account}`}
                        {source.lastSyncedAt &&
                          ` · ${formatDistanceToNow(new Date(source.lastSyncedAt), { addSuffix: true })}`}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={syncing.includes(source.id)}
                    onClick={() => void sync(source.id, true)}
                    aria-label={`Refresh ${source.name}`}
                    className="rounded-full px-2 py-0.5 text-ink-soft hover:bg-butter hover:text-ink disabled:opacity-60"
                  >
                    {syncing.includes(source.id) ? '…' : '↻'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(source.id)}
                    aria-label={`Remove ${source.name}`}
                    className="rounded-full px-2 py-0.5 text-ink-soft hover:bg-rose hover:text-ink"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <CanvasForm />

      <div className="flex flex-wrap gap-2">
        <ConnectButton
          label="Connect Google Calendar"
          configured={googleReady}
          busy={connecting === 'google'}
          onClick={() => void connectGoogle()}
        />
        <ConnectButton
          label="Connect Outlook"
          configured={outlookReady}
          busy={connecting === 'outlook'}
          onClick={() => void connectOutlook()}
        />
      </div>
      {(!googleReady || !outlookReady) && (
        <p className="text-xs text-ink-soft">
          Google and Outlook need a free app ID first. The steps are in docs/calendar-setup.md.
        </p>
      )}

      <OptionRow label="Show">
        {DAY_CHOICES.map((days) => (
          <ChoiceButton
            key={days}
            pressed={config.days === days}
            onClick={() => onChange('change days shown', { days })}
          >
            {days} days
          </ChoiceButton>
        ))}
        <ChoiceButton
          pressed={config.showTasks}
          onClick={() => onChange('toggle tasks in calendar', { showTasks: !config.showTasks })}
        >
          Tasks with due dates
        </ChoiceButton>
      </OptionRow>
    </StylePanel>
  )
}

function ConnectButton({
  label,
  configured,
  busy,
  onClick,
}: {
  label: string
  configured: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!configured || busy}
      onClick={onClick}
      title={configured ? undefined : 'Not set up yet: see docs/calendar-setup.md'}
      className="rounded-full border border-ink/25 bg-paper px-3 py-1 hover:bg-butter disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Connecting…' : label}
    </button>
  )
}

function CanvasForm() {
  const addCanvas = useCalendarStore((s) => s.addCanvas)
  const connecting = useCalendarStore((s) => s.connecting === 'canvas')
  const [name, setName] = useState('Canvas')
  const [url, setUrl] = useState('')
  const helpId = useId()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (await addCanvas(name, url)) {
      setUrl('')
      setName('Canvas')
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Add a Canvas calendar" className="space-y-1.5">
      <p className="text-ink-soft">Add a Canvas calendar</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Calendar name"
          maxLength={40}
          className="w-28 rounded-full border border-ink/25 bg-paper px-3 py-1 focus:border-ink/60 focus:outline-none"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Canvas feed link"
          aria-describedby={helpId}
          placeholder="https://…/feeds/calendars/….ics"
          className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-3 py-1 focus:border-ink/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={connecting || !url.trim()}
          className="rounded-full bg-mint px-3 py-1 hover:bg-mint/70 disabled:opacity-60"
        >
          {connecting ? 'Checking…' : 'Add'}
        </button>
      </div>
      <p id={helpId} className="text-xs text-ink-soft">
        In Canvas, open Calendar and click "Calendar Feed" (bottom right), then copy the link. It
        works like a password for your calendar, so it's only stored in this browser.
      </p>
    </form>
  )
}
