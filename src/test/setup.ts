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
import { initialTasksState, useTasksStore } from '../widgets/todo/tasksStore'

// findBy*/waitFor give up after 1s by default. UI tests here wait on (fake)
// IndexedDB, which can take longer when the whole suite runs in parallel on a busy machine.
configure({ asyncUtilTimeout: 3000 })

// Every test starts from an empty database and fresh stores. Zustand stores are
// module-level singletons, so without this one test's state would leak into the next.
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  useTasksStore.setState(initialTasksState)
  useLayoutStore.setState(initialLayoutState)
  useUndoStore.setState({ entries: [], busy: false })
  useErrorStore.setState({ message: null })
})

afterEach(() => {
  cleanup()
})
