import { create } from 'zustand'

interface ErrorState {
  /** The latest failure to show the user, or null. */
  message: string | null
  report: (error: unknown, prefix?: string) => void
  clear: () => void
}

/**
 * One place for "something went wrong" messages, shown in the hub toolbar.
 * With several widgets on a page, a shared banner beats each widget showing
 * its own copy of the same error.
 */
export const useErrorStore = create<ErrorState>()((set) => ({
  message: null,
  report: (error, prefix = '') => set({ message: prefix + messageOf(error) }),
  clear: () => set({ message: null }),
}))

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
