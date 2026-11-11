import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { canvasFeedDevServer } from './server/devPlugin.js'

// https://vite.dev/config/
// `defineConfig` comes from vitest/config so the `test` block below is type-checked.
export default defineConfig({
  plugins: [react(), tailwindcss(), canvasFeedDevServer()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest skips CSS by default (it would come through empty). theme.css is
    // processed so textStyles.test.ts can read its real colors via `?raw`.
    css: { include: [/theme\.css/] },
    // Default is 5s; full UI flows against IndexedDB can exceed that under parallel load.
    testTimeout: 15_000,
  },
})
