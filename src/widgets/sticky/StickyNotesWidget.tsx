import { format, parseISO } from 'date-fns'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useUndoStore } from '../../state/undoStore'
import type { CategoryColor } from '../../storage/categories'
import { MAX_STICKY_LENGTH, type StickyNote } from '../../storage/stickies'
import { PASTEL_BG } from '../../theme/pastels'
import { widgetTitle, type WidgetProps } from '../registry'
import { useStickyStore, type BoardState } from './stickyStore'

/** Typing pauses this long before the pad saves. */
export const STICKY_SAVE_DELAY_MS = 700

const PAD_COLORS: CategoryColor[] = ['butter', 'peach', 'rose', 'lavender', 'sky', 'mint']
const STICKY_FONT = "'Patrick Hand', 'Comic Sans MS', cursive"

/**
 * A pad for quick thoughts. Write, then "Stick it aside" to move the note onto
 * a pile and get a fresh pad. The pile opens to show every note, each deletable.
 */
export function StickyNotesWidget({ widget }: WidgetProps) {
  // Every sticky widget is created with a boardId; the widget's own id is a
  // fallback so a damaged layout still works.
  const boardId = typeof widget.config.boardId === 'string' ? widget.config.boardId : widget.id
  const name = widgetTitle(widget)
  const board = useStickyStore((s) => s.boards[boardId])
  const load = useStickyStore((s) => s.load)
  const [pileOpen, setPileOpen] = useState(false)
  const [justStuck, setJustStuck] = useState(false)

  useEffect(() => {
    void load(boardId)
  }, [boardId, load])

  if (!board || board.status === 'loading') {
    return <p className="text-ink-soft">Loading…</p>
  }

  return (
    <section aria-label={name} className="space-y-4">
      {/* Side by side when the widget is wider than 28rem, pile under the pad when narrower. */}
      <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
        <Pad
          // Remount when the stored text was replaced (undo, or a note stuck aside).
          key={board.version}
          boardId={boardId}
          board={board}
          name={name}
          onStuck={() => setJustStuck(true)}
        />
        <Pile
          notes={board.notes}
          open={pileOpen}
          bounce={justStuck}
          onToggle={() => setPileOpen((o) => !o)}
        />
      </div>
      {pileOpen && (
        <NoteList boardId={boardId} notes={board.notes} onClose={() => setPileOpen(false)} />
      )}
    </section>
  )
}

interface PadProps {
  boardId: string
  board: BoardState
  name: string
  onStuck: () => void
}

function Pad({ boardId, board, name, onStuck }: PadProps) {
  const { saveDraft, restoreDraft, setColor, stickAside } = useStickyStore.getState()
  const [text, setText] = useState(board.draft)
  const [sticking, setSticking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // The text the undo stack knows about; leaving the pad with different text makes an undo step.
  const baseline = useRef(board.draft)
  const latest = useRef(board.draft)
  const hintId = useId()

  function flush() {
    clearTimeout(timer.current)
    timer.current = undefined
    if (latest.current !== board.draft) void saveDraft(boardId, latest.current)
  }

  // Leaving (or remounting) saves anything typed but not yet saved.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void useStickyStore.getState().saveDraft(boardId, latest.current)
      }
    },
    [boardId],
  )

  function handleChange(value: string) {
    const next = value.slice(0, MAX_STICKY_LENGTH)
    setText(next)
    latest.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, STICKY_SAVE_DELAY_MS)
  }

  function handleBlur() {
    flush()
    const before = baseline.current
    if (text === before) return
    baseline.current = text
    useUndoStore.getState().push({
      label: 'edit sticky note',
      undo: () => restoreDraft(boardId, before),
    })
  }

  async function stick() {
    if (!text.trim() || sticking) return
    clearTimeout(timer.current)
    timer.current = undefined
    setSticking(true)
    // On success the store bumps the board's version, which remounts this pad empty.
    if (await stickAside(boardId, text)) onStuck()
    else setSticking(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void stick()
    }
  }

  return (
    <div
      className={`sticky-pad min-w-0 flex-1 rounded-sm px-4 pt-5 pb-3 ${PASTEL_BG[board.color]}`}
    >
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={`${name}: new note`}
        aria-describedby={hintId}
        placeholder="Jot a quick thought…"
        maxLength={MAX_STICKY_LENGTH}
        rows={4}
        style={{ fontFamily: STICKY_FONT }}
        className="block min-h-24 w-full resize-y bg-transparent text-lg leading-snug wrap-anywhere placeholder:text-ink-soft focus:outline-2 focus:outline-offset-4 focus:outline-ink/30 focus:outline-dashed"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Note color" className="flex gap-1">
          {PAD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={board.color === color}
              title={color}
              onClick={() => void setColor(boardId, color)}
              className={`size-5 rounded-full border-2 ${PASTEL_BG[color]} ${board.color === color ? 'border-ink' : 'border-ink/25 hover:border-ink/60'}`}
            />
          ))}
        </div>
        <button
          type="button"
          // Keeps focus in the pad, so sticking is one undo step (not "edit" and then "stick").
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void stick()}
          disabled={!text.trim() || sticking}
          className="rounded-full border border-ink/30 bg-card px-3 py-1 text-sm hover:bg-paper disabled:opacity-50"
        >
          Stick it aside <span aria-hidden>→</span>
        </button>
      </div>
      <p id={hintId} className="sr-only">
        Press Control and Enter to stick the note aside.
      </p>
    </div>
  )
}

interface PileProps {
  notes: StickyNote[]
  open: boolean
  bounce: boolean
  onToggle: () => void
}

/** The stack of stuck-aside notes: the newest on top, a couple peeking out behind it. */
function Pile({ notes, open, bounce, onToggle }: PileProps) {
  if (notes.length === 0) {
    return (
      <p className="text-center font-hand text-xl text-ink-soft @md:w-40 @md:pt-6">
        Stuck notes pile up here.
      </p>
    )
  }
  const [top, ...rest] = notes
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="group mx-auto w-40 shrink-0 text-left"
    >
      <span className="relative block h-28">
        {rest.slice(0, 2).map((note, i) => (
          <span
            key={note.id}
            aria-hidden
            className={`absolute inset-0 rounded-sm border border-ink/10 ${PASTEL_BG[note.color]} ${i === 0 ? 'rotate-3' : '-rotate-4'}`}
          />
        ))}
        <span
          // Re-keyed per note, so the bounce replays each time a note lands on the pile.
          key={top.id}
          className={`sticky-slip absolute inset-0 overflow-hidden rounded-sm p-2 text-sm leading-snug ${PASTEL_BG[top.color]} ${bounce ? 'motion-safe:animate-pop' : ''}`}
          style={{ fontFamily: STICKY_FONT }}
        >
          <span aria-hidden className="line-clamp-4 wrap-anywhere">
            {top.text}
          </span>
        </span>
      </span>
      <span className="mt-2 block text-center text-sm text-ink-soft group-hover:text-ink">
        {open ? 'Hide notes' : `Show all ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}{' '}
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </span>
    </button>
  )
}

function NoteList({
  boardId,
  notes,
  onClose,
}: {
  boardId: string
  notes: StickyNote[]
  onClose: () => void
}) {
  const remove = useStickyStore((s) => s.remove)
  if (notes.length === 0) return null
  return (
    <div className="rounded-sm border border-dashed border-ink/25 bg-card/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-hand text-2xl font-bold">All notes</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-sm text-ink-soft hover:bg-paper hover:text-ink"
        >
          Close
        </button>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
        {notes.map((note) => (
          <li
            key={note.id}
            className={`relative flex flex-col rounded-sm p-3 pr-7 shadow-[1px_2px_0_rgb(61_53_80/0.12)] ${PASTEL_BG[note.color]}`}
          >
            <p
              className="flex-1 text-base leading-snug wrap-anywhere whitespace-pre-wrap"
              style={{ fontFamily: STICKY_FONT }}
            >
              {note.text}
            </p>
            <time dateTime={note.createdAt} className="mt-2 text-xs text-ink-soft">
              {format(parseISO(note.createdAt), 'MMM d, h:mm a')}
            </time>
            <button
              type="button"
              onClick={() => void remove(boardId, note.id)}
              aria-label={`Delete note "${preview(note.text)}"`}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full text-ink-soft hover:bg-card hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The first few words of a note, for button names like Delete note "Call mom about…". */
function preview(text: string) {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 30 ? `${oneLine.slice(0, 30)}…` : oneLine
}
