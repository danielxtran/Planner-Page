import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useState } from 'react'
import { docHasText, type JournalEntry } from '../../storage/journal'
import { PASTEL_BG } from '../../theme/pastels'
import { localDate } from '../calendar/syncWindow'
import { MOOD_META } from './journalData'

interface JournalCalendarProps {
  entries: Record<string, JournalEntry>
  /** The day being shown ('yyyy-MM-dd'). */
  selected: string
  today: string
  onSelect: (date: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * A month of days. Days with an entry carry a dot in their mood's color (or
 * an ink dot if no mood was picked). Future days can't be opened.
 */
export function JournalCalendar({ entries, selected, today, onSelect }: JournalCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(selected)))
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })
  const atCurrentMonth = isSameMonth(month, parseISO(today))
  const written = Object.values(entries).filter(
    (e) => isSameMonth(parseISO(e.date), month) && (docHasText(e.doc) || e.mood),
  ).length

  return (
    <div className="mt-3 rounded-sm border border-dashed border-ink/25 bg-paper/60 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Previous month"
          className="grid size-7 place-items-center rounded-full hover:bg-butter"
        >
          ‹
        </button>
        <p className="text-center font-hand text-xl font-bold" aria-live="polite">
          {format(month, 'MMMM yyyy')}
          <span className="block font-sans text-xs font-normal text-ink-soft">
            {written} {written === 1 ? 'entry' : 'entries'}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={atCurrentMonth}
          aria-label="Next month"
          className="grid size-7 place-items-center rounded-full hover:bg-butter disabled:opacity-40"
        >
          ›
        </button>
      </div>
      <table className="w-full table-fixed border-collapse text-center text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 text-xs font-normal text-ink-soft">
                <abbr title={d} className="no-underline">
                  {d.charAt(0)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const date = localDate(day)
                const inMonth = isSameMonth(day, month)
                const entry = entries[date]
                const hasEntry = Boolean(entry && (docHasText(entry.doc) || entry.mood))
                const mood = entry?.mood ? MOOD_META[entry.mood] : null
                const future = date > today
                const label = [
                  format(day, 'EEEE, MMMM d'),
                  date === today && 'today',
                  hasEntry && (mood ? `mood ${mood.label}` : 'written'),
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <td key={date} className="p-0.5">
                    {inMonth && (
                      <button
                        type="button"
                        disabled={future}
                        aria-label={label}
                        aria-pressed={date === selected}
                        aria-current={date === today ? 'date' : undefined}
                        onClick={() => onSelect(date)}
                        className={`relative mx-auto grid aspect-square w-full max-w-9 place-items-center rounded-full ${date === selected ? 'bg-lavender font-bold ring-2 ring-ink/50' : 'hover:bg-butter'} ${date === today ? 'border border-ink/50' : ''} disabled:cursor-default disabled:text-ink-soft/70 disabled:hover:bg-transparent`}
                      >
                        <span aria-hidden>{format(day, 'd')}</span>
                        {hasEntry && (
                          <span
                            aria-hidden
                            className={`absolute bottom-0.5 size-1.5 rounded-full ${mood ? `${PASTEL_BG[mood.color]} ring-1 ring-ink/40` : 'bg-ink/60'}`}
                          />
                        )}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
