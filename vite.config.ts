import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// `defineConfig` comes from vitest/config so the `test` block below is type-checked.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Default is 5s; full UI flows against IndexedDB can exceed that under parallel load.
    testTimeout: 15_000,
  },
})
