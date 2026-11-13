import { useId, useRef, useState, type FormEvent } from 'react'
import { MAX_PAGE_NAME_LENGTH } from '../storage/pages'
import { useLayoutStore } from './layoutStore'

interface PageTabsProps {
  /** Called after a new page opens, so the hub can switch to editing it. */
  onPageAdded: () => void
}

/**
 * Index-card tabs along the top, one per page (Home, School, Work…). The open
 * page's tab has a small menu for renaming and deleting it.
 */
export function PageTabs({ onPageAdded }: PageTabsProps) {
  const pages = useLayoutStore((s) => s.pages)
  const pageId = useLayoutStore((s) => s.pageId)
  const openPage = useLayoutStore((s) => s.openPage)
  const addPage = useLayoutStore((s) => s.addPage)
  const [naming, setNaming] = useState<{ mode: 'new' } | { mode: 'rename'; id: string } | null>(
    null,
  )
  const [menuOpen, setMenuOpen] = useState(false)

  if (pages.length === 0) return null

  return (
    <nav aria-label="Pages" className="mb-3">
      <ul className="flex flex-wrap items-end gap-1 border-b-2 border-ink/15">
        {pages.map((page) => {
          const current = page.id === pageId
          if (naming?.mode === 'rename' && naming.id === page.id) {
            return (
              <li key={page.id}>
                <NameForm
                  label="Page name"
                  initial={page.name}
                  onDone={(name) => {
                    setNaming(null)
                    if (name) void useLayoutStore.getState().renamePage(page.id, name)
                  }}
                />
              </li>
            )
          }
          return (
            <li key={page.id} className="relative">
              <div
                className={`flex items-center rounded-t-md border-2 border-b-0 ${current ? '-mb-0.5 border-ink/25 bg-card' : 'border-transparent bg-paper/70 hover:bg-card'}`}
              >
                <button
                  type="button"
                  aria-current={current ? 'page' : undefined}
                  onClick={() => {
                    setMenuOpen(false)
                    void openPage(page.id)
                  }}
                  className={`max-w-48 truncate px-3 py-1.5 font-hand text-xl ${current ? 'font-bold' : 'text-ink-soft'}`}
                >
                  {page.name}
                </button>
                {current && (
                  <button
                    type="button"
                    aria-label={`Options for page "${page.name}"`}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((o) => !o)}
                    className="mr-1 grid size-6 place-items-center rounded-full text-ink-soft hover:bg-butter hover:text-ink"
                  >
                    ⋯
                  </button>
                )}
              </div>
              {current && menuOpen && (
                <PageMenu
                  pageId={page.id}
                  pageName={page.name}
                  canDelete={pages.length > 1}
                  onRename={() => {
                    setMenuOpen(false)
                    setNaming({ mode: 'rename', id: page.id })
                  }}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </li>
          )
        })}
        <li>
          {naming?.mode === 'new' ? (
            <NameForm
              label="New page name"
              initial=""
              onDone={async (name) => {
                setNaming(null)
                if (name && (await addPage(name))) onPageAdded()
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setNaming({ mode: 'new' })
              }}
              className="rounded-t-md px-3 py-1.5 text-sm text-ink-soft hover:bg-card hover:text-ink"
            >
              + New page
            </button>
          )}
        </li>
      </ul>
    </nav>
  )
}

function PageMenu({
  pageId,
  pageName,
  canDelete,
  onRename,
  onClose,
}: {
  pageId: string
  pageName: string
  canDelete: boolean
  onRename: () => void
  onClose: () => void
}) {
  const removePage = useLayoutStore((s) => s.removePage)
  return (
    <div
      role="group"
      aria-label={`Options for page "${pageName}"`}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="absolute top-full left-0 z-40 mt-1 w-44 rounded-sm bg-card p-1 text-sm shadow-[2px_3px_0_rgb(61_53_80/0.15)]"
    >
      <button
        type="button"
        autoFocus
        onClick={onRename}
        className="block w-full rounded-sm px-3 py-1.5 text-left hover:bg-butter"
      >
        Rename
      </button>
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => {
          onClose()
          void removePage(pageId)
        }}
        title={canDelete ? undefined : 'You need at least one page'}
        className="block w-full rounded-sm px-3 py-1.5 text-left hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
      >
        Delete page
      </button>
    </div>
  )
}

/** A small inline name box: Enter or clicking away saves, Escape cancels. */
function NameForm({
  label,
  initial,
  onDone,
}: {
  label: string
  initial: string
  /** The trimmed name, or null if cancelled or left empty. */
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const finished = useRef(false)
  const hintId = useId()

  function finish(save: boolean) {
    if (finished.current) return
    finished.current = true
    onDone(save && value.trim() ? value.trim() : null)
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        finish(true)
      }}
      className="px-1 pb-1"
    >
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => e.key === 'Escape' && finish(false)}
        aria-label={label}
        aria-describedby={hintId}
        maxLength={MAX_PAGE_NAME_LENGTH}
        placeholder="e.g. School"
        className="w-36 rounded-sm border-2 border-ink/40 bg-card px-2 py-0.5 font-hand text-xl focus:outline-none"
      />
      <span id={hintId} className="sr-only">
        Press Enter to save or Escape to cancel.
      </span>
    </form>
  )
}
