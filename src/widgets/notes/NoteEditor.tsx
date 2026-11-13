import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useErrorStore } from '../../state/errorStore'
import { useUndoStore } from '../../state/undoStore'
import type { NoteDoc } from '../../storage/notes'
import { isSafeLink, normalizeLink } from './links'
import { useNotesStore } from './notesStore'

/** How long typing must pause before the note saves. Short enough that a refresh loses nothing. */
export const NOTE_SAVE_DELAY_MS = 600

const DEFAULT_PLACEHOLDER = 'Jot something down… (try "- " or "[ ] ")'

// Built once per placeholder (see useMemo below): TipTap rebuilds the editor if the extension list changes.
const buildExtensions = (placeholder: string) => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    // A planner rarely needs code blocks; leaving them out keeps the toolbar and shortcuts simple.
    codeBlock: false,
    link: {
      autolink: true,
      defaultProtocol: 'https',
      // Belt and braces: TipTap already rejects javascript: links; this also limits pasted ones.
      isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && isSafeLink(url),
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder }),
]

interface NoteEditorProps {
  /**
   * Names this document (a note id, a journal date). When an undo replaces the
   * text, the editor showing it is remounted; see useNotesStore.versions.
   */
  docKey: string
  initialDoc: NoteDoc
  /** The widget's title, for accessible names and undo labels. */
  name: string
  /** Writes the document to storage. The editor decides when; this decides where. */
  save: (doc: NoteDoc) => Promise<unknown>
  placeholder?: string
}

/**
 * The rich-text editor used by notes and the journal. It saves on its own, shortly after you
 * stop typing. For undo, typing inside the note uses the editor's own Ctrl+Z;
 * each stretch of editing (from focusing the note to leaving it) also becomes
 * one step on the hub's undo stack, so the toolbar's Undo can take it back later.
 */
export function NoteEditor({
  docKey,
  initialDoc,
  name,
  save,
  placeholder = DEFAULT_PLACEHOLDER,
}: NoteEditorProps) {
  const extensions = useMemo(() => buildExtensions(placeholder), [placeholder])
  // The contents the undo stack already knows about. A finished editing stretch
  // that differs from this becomes an undo step back to it.
  const baseline = useRef({ doc: initialDoc, text: JSON.stringify(initialDoc) })
  // Typed but not saved yet. Kept in a ref so saving works even mid-unmount.
  const unsaved = useRef<NoteDoc | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Saves run one after another, so an older save can never land after a newer one.
  const saving = useRef<Promise<void>>(Promise.resolve())

  function flush(): Promise<void> {
    clearTimeout(timer.current)
    const doc = unsaved.current
    if (!doc) return saving.current
    unsaved.current = null
    saving.current = saving.current
      .then(() => save(doc))
      .then(
        () => undefined,
        (e: unknown) => useErrorStore.getState().report(e, "Couldn't save your note: "),
      )
    return saving.current
  }

  function endEditingStretch(doc: NoteDoc) {
    const text = JSON.stringify(doc)
    const saved = flush()
    if (text === baseline.current.text) return
    const before = baseline.current.doc
    baseline.current = { doc, text }
    useUndoStore.getState().push({
      label: `edit ${name}`,
      undo: async () => {
        await saved
        await save(before)
        // Remount the editor (wherever it is now) so it shows the restored text.
        useNotesStore.getState().bump(docKey)
      },
    })
  }

  const editor = useEditor({
    extensions,
    // Storage types the document loosely (it doesn't depend on TipTap); this is TipTap's own shape.
    content: initialDoc as JSONContent,
    editorProps: {
      attributes: {
        class: 'note-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': `${name} text`,
      },
    },
    onUpdate: ({ editor }) => {
      unsaved.current = editor.getJSON() as NoteDoc
      if (editor.isFocused) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), NOTE_SAVE_DELAY_MS)
      } else {
        // A change made without focusing the note (like ticking a checklist box) is its own step.
        endEditingStretch(unsaved.current)
      }
    },
    onBlur: ({ editor }) => endEditingStretch(editor.getJSON() as NoteDoc),
  })

  // Leaving the page (widget removed, or the hub unmounting) saves anything still pending.
  useEffect(
    () => () => {
      void flush()
    },
    // flush only reads refs, so the first one stays correct for the editor's whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    // `group` lets the toolbar appear while anything in the note has focus.
    <div className="group rounded-sm focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ink/30 focus-within:outline-dashed">
      <EditorContent editor={editor} />
      {editor && <NoteToolbar editor={editor} name={name} />}
    </div>
  )
}

function NoteToolbar({ editor, name }: { editor: Editor; name: string }) {
  // Re-renders the toolbar when the cursor moves, so buttons show what's active where you are.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: e.isActive('heading', { level: 2 }),
      subheading: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bulletList: e.isActive('bulletList'),
      taskList: e.isActive('taskList'),
      link: e.isActive('link'),
    }),
  })
  const [linkOpen, setLinkOpen] = useState(false)
  const chain = () => editor.chain().focus()

  return (
    <div className="mt-2">
      <div
        role="toolbar"
        aria-label={`Formatting for ${name}`}
        className={`flex-wrap gap-1 ${linkOpen ? 'flex' : 'hidden group-focus-within:flex'}`}
      >
        <ToolButton
          label="Heading"
          pressed={active.heading}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          H
        </ToolButton>
        <ToolButton
          label="Subheading"
          pressed={active.subheading}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          <span className="text-xs">H</span>
        </ToolButton>
        <ToolButton label="Bold" pressed={active.bold} onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </ToolButton>
        <ToolButton
          label="Italic"
          pressed={active.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <i className="font-serif">I</i>
        </ToolButton>
        <ToolButton
          label="Bulleted list"
          pressed={active.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          •
        </ToolButton>
        <ToolButton
          label="Checklist"
          pressed={active.taskList}
          onClick={() => chain().toggleTaskList().run()}
        >
          ☐
        </ToolButton>
        <ToolButton
          label={active.link ? 'Remove link' : 'Add link'}
          pressed={active.link}
          onClick={() =>
            active.link ? chain().extendMarkRange('link').unsetLink().run() : setLinkOpen(true)
          }
        >
          <span aria-hidden>🔗</span>
        </ToolButton>
      </div>
      {linkOpen && <LinkForm editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  )
}

interface ToolButtonProps {
  label: string
  pressed: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, pressed, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      // Keeps the cursor (and the selection to format) in the note when a button is clicked.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-7 min-w-7 place-items-center rounded-sm border px-1.5 text-sm ${pressed ? 'border-ink/60 bg-lavender' : 'border-ink/20 bg-paper hover:bg-butter'}`}
    >
      {children}
    </button>
  )
}

function LinkForm({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const errorId = useId()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const href = normalizeLink(value)
    if (!href) {
      setInvalid(true)
      return
    }
    const chain = editor.chain().focus()
    if (editor.state.selection.empty) {
      // Nothing selected: insert the address itself as the link text.
      chain.insertContent({
        type: 'text',
        text: value.trim(),
        marks: [{ type: 'link', attrs: { href } }],
      })
    } else {
      chain.extendMarkRange('link').setLink({ href })
    }
    chain.run()
    onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add link"
      className="mt-2 flex flex-wrap items-center gap-2 text-sm"
    >
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setInvalid(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
            editor.commands.focus()
          }
        }}
        aria-label="Link address"
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        placeholder="example.com"
        className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-3 py-1 focus:border-ink/60 focus:outline-none"
      />
      <button type="submit" className="rounded-full bg-mint px-3 py-1 hover:bg-mint/70">
        Save link
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full px-3 py-1 text-ink-soft hover:bg-paper hover:text-ink"
      >
        Cancel
      </button>
      {invalid && (
        <p id={errorId} className="w-full text-ink-soft">
          That doesn't look like a web or email address.
        </p>
      )}
    </form>
  )
}
