import { addDays, format, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'
import { MOODS, type Mood } from '../../storage/journal'
import { EMPTY_NOTE_DOC, type NoteDoc } from '../../storage/notes'
import { localDate } from '../calendar/syncWindow'
import { NoteEditor } from '../notes/NoteEditor'
import { useNotesStore } from '../notes/notesStore'
import type { WidgetProps } from '../registry'
import { WidgetCard } from '../WidgetCard'
import { JournalCalendar } from './JournalCalendar'
import { MOOD_META, nextPrompt, promptFor } from './journalData'
import { useJournalStore } from './journalStore'

const DEFAULT_TITLE = 'Journal'

/**
 * A daily journal: today's prompt, a mood, and a page to write on, plus a
 * calendar to look back at earlier days. There's one journal: every journal
 * widget shows the same entries.
 */
export function JournalWidget({ widget, onConfigChange }: WidgetProps) {
  const title = typeof widget.config.title === 'string' ? widget.config.title.trim() : ''
  const { status, entries, ensureLoaded, saveDoc, setMood, setPrompt } = useJournalStore()
  // Re-read the date every minute, so an open hub rolls over to the new day at midnight.
  const [today, setToday] = useState(() => localDate(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setToday(localDate(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  // null = "today", so the widget follows the date when it changes.
  const [picked, setPicked] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const date = picked && picked <= today ? picked : today
  const docKey = `journal:${date}`
  const version = useNotesStore((s) => s.versions[docKey] ?? 0)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const entry = entries[date]
  const prompt = entry?.prompt ?? promptFor(date)
  const shownTitle = title || DEFAULT_TITLE
  const isToday = date === today

  function go(next: string) {
    setPicked(next >= today ? null : next)
  }

  return (
    <WidgetCard
      title={shownTitle}
      defaultTitle={DEFAULT_TITLE}
      onRename={(next) => onConfigChange('rename widget', { ...widget.config, title: next })}
      tape="rose"
      aside={
        <button
          type="button"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((o) => !o)}
          className="rounded-full border border-ink/25 bg-paper px-2.5 py-0.5 hover:bg-butter"
        >
          <span aria-hidden>📅 </span>Past entries
        </button>
      }
    >
      {status !== 'ready' ? (
        <p className="text-ink-soft">
          {status === 'error' ? "Couldn't load the journal." : 'Loading…'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(localDate(addDays(parseISO(date), -1)))}
              aria-label="Previous day"
              className="grid size-7 place-items-center rounded-full hover:bg-butter"
            >
              ‹
            </button>
            <h3 className="min-w-0 flex-1 text-center font-hand text-2xl" aria-live="polite">
              {isToday ? 'Today, ' : ''}
              {format(parseISO(date), isToday ? 'MMMM d' : 'EEEE, MMMM d, yyyy')}
            </h3>
            <button
              type="button"
              onClick={() => go(localDate(addDays(parseISO(date), 1)))}
              disabled={isToday}
              aria-label="Next day"
              className="grid size-7 place-items-center rounded-full hover:bg-butter disabled:opacity-40"
            >
              ›
            </button>
          </div>
          {!isToday && (
            <p className="text-center">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-sm text-ink-soft underline decoration-dashed underline-offset-4 hover:text-ink"
              >
                Back to today
              </button>
            </p>
          )}

          {calendarOpen && (
            <JournalCalendar
              // A new calendar per shown month: picking a day elsewhere moves it to that month.
              key={date.slice(0, 7)}
              entries={entries}
              selected={date}
              today={today}
              onSelect={go}
            />
          )}

          <div className="mt-3 flex items-start gap-2 rounded-sm bg-butter/70 px-3 py-2">
            <span aria-hidden>✏️</span>
            <p className="min-w-0 flex-1 italic">{prompt}</p>
            <button
              type="button"
              onClick={() => void setPrompt(date, nextPrompt(prompt))}
              className="shrink-0 rounded-full px-2 py-0.5 text-xs text-ink-soft hover:bg-card hover:text-ink"
            >
              Another prompt
            </button>
          </div>

          <div role="group" aria-label="Mood" className="mt-3 flex flex-wrap items-center gap-1.5">
            <span aria-hidden className="mr-1 text-sm text-ink-soft">
              Mood
            </span>
            {MOODS.map((mood) => {
              const meta = MOOD_META[mood]
              const pressed = entry?.mood === mood
              return (
                <button
                  key={mood}
                  type="button"
                  aria-pressed={pressed}
                  // Clicking the picked mood again clears it.
                  onClick={() => void setMood(date, pressed ? null : mood, prompt)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm ${pressed ? `border-ink/60 ${MOOD_BG[mood]}` : 'border-dashed border-ink/30 hover:bg-paper'}`}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            <NoteEditor
              key={`${docKey}:${version}`}
              docKey={docKey}
              initialDoc={entry?.doc ?? EMPTY_NOTE_DOC}
              name={`${shownTitle} for ${format(parseISO(date), 'MMMM d')}`}
              save={(doc: NoteDoc) => saveDoc(date, doc, prompt)}
              placeholder={isToday ? 'Write about your day…' : 'Nothing written this day yet.'}
            />
          </div>
        </>
      )}
    </WidgetCard>
  )
}

/** Full class names, so Tailwind's scanner sees them (a built `bg-${color}` wouldn't be). */
const MOOD_BG: Record<Mood, string> = {
  great: 'bg-mint',
  good: 'bg-sky',
  okay: 'bg-butter',
  low: 'bg-lavender',
  rough: 'bg-rose',
}
