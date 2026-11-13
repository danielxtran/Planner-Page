// Gives Node an in-memory IndexedDB so Dexie works in tests.
import 'fake-indexeddb/auto'
// Adds DOM matchers like toBeInTheDocument() to Vitest's expect.
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { initialLayoutState, useLayoutStore } from '../layout/layoutStore'
import { useErrorStore } from '../state/errorStore'
import { useUndoStore } from '../state/undoStore'
import { db } from '../storage/db'
import { initialCalendarState, useCalendarStore } from '../widgets/calendar/calendarStore'
import { initialJournalState, useJournalStore } from '../widgets/journal/journalStore'
import { useNotesStore } from '../widgets/notes/notesStore'
import { useStickyStore } from '../widgets/sticky/stickyStore'
import { initialTasksState, useTasksStore } from '../widgets/todo/tasksStore'

// jsdom doesn't do layout, so it lacks the measuring functions ProseMirror (the
// notes editor) calls to scroll the cursor into view. Empty stand-ins are enough.
// (Server tests run in plain Node with no DOM at all, hence the check.)
if (typeof document !== 'undefined') {
  Range.prototype.getClientRects ??= function () {
    return Object.assign([], { item: () => null }) as unknown as DOMRectList
  }
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  document.elementFromPoint ??= () => null
}

// findBy*/waitFor give up after 1s by default. UI tests here wait on (fake)
// IndexedDB, which can take longer when the whole suite runs in parallel on a busy machine.
configure({ asyncUtilTimeout: 3000 })

// Every test starts from an empty database and fresh stores. Zustand stores are
// module-level singletons, so without this one test's state would leak into the next.
beforeEach(async () => {
  // (Server tests run in plain Node, which may have no localStorage.)
  if (typeof localStorage !== 'undefined') localStorage.clear()
  await Promise.all(db.tables.map((table) => table.clear()))
  useTasksStore.setState(initialTasksState)
  useLayoutStore.setState(initialLayoutState)
  useUndoStore.setState({ entries: [], busy: false })
  useErrorStore.setState({ message: null })
  useNotesStore.setState({ versions: {} })
  useCalendarStore.setState(initialCalendarState)
  useStickyStore.setState({ boards: {} })
  useJournalStore.setState(initialJournalState)
})

afterEach(() => {
  cleanup()
})
