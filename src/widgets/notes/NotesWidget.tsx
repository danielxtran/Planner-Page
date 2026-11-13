import { useEffect, useState } from 'react'
import { messageOf } from '../../state/errorStore'
import { EMPTY_NOTE_DOC, getNote, saveNote, type NoteDoc } from '../../storage/notes'
import type { WidgetProps } from '../registry'
import { WidgetCard } from '../WidgetCard'
import { NoteEditor } from './NoteEditor'
import { useNotesStore } from './notesStore'

const DEFAULT_TITLE = 'Notes'

type Loaded = { key: string; doc: NoteDoc } | { key: string; error: string }

/** A notes widget: a rich-text page whose contents are saved in the notes table. */
export function NotesWidget({ widget, onConfigChange }: WidgetProps) {
  const title = typeof widget.config.title === 'string' ? widget.config.title.trim() : ''
  // Every notes widget is created with a noteId. Falling back to the widget's
  // own id keeps a damaged layout usable instead of crashing.
  const noteId = typeof widget.config.noteId === 'string' ? widget.config.noteId : widget.id
  const version = useNotesStore((s) => s.versions[noteId] ?? 0)
  const key = `${noteId}:${version}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let current = true
    getNote(noteId).then(
      (note) => current && setLoaded({ key, doc: note?.doc ?? EMPTY_NOTE_DOC }),
      (e: unknown) => current && setLoaded({ key, error: messageOf(e) }),
    )
    // A newer load (or unmount) makes this one stale, so its result is ignored.
    return () => {
      current = false
    }
  }, [noteId, key])

  const shownTitle = title || DEFAULT_TITLE

  return (
    <WidgetCard
      title={shownTitle}
      defaultTitle={DEFAULT_TITLE}
      onRename={(next) => onConfigChange('rename widget', { ...widget.config, title: next })}
      tape="mint"
    >
      {loaded?.key !== key ? (
        <p className="text-ink-soft">Loading…</p>
      ) : 'error' in loaded ? (
        <p role="alert" className="rounded-sm bg-rose px-3 py-2 text-sm">
          Couldn't load this note: {loaded.error}
        </p>
      ) : (
        // Keyed by version: after an undo restores older text, a fresh editor starts from it.
        <NoteEditor
          key={key}
          docKey={noteId}
          initialDoc={loaded.doc}
          name={shownTitle}
          save={(doc) => saveNote(noteId, doc)}
        />
      )}
    </WidgetCard>
  )
}
