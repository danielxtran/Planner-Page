import { useEffect } from 'react'
import { useTasksStore } from './tasksStore'

/** The shared task store, loaded on first use. A thin hook so components don't repeat the setup. */
export function useTasks() {
  const store = useTasksStore()
  const { ensureLoaded } = store

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  return { ...store, loading: store.status === 'idle' || store.status === 'loading' }
}
