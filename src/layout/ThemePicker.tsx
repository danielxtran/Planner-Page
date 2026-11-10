import { resolveTheme, THEMES } from '../theme/themes'
import { useLayoutStore } from './layoutStore'

/** Two little swatch buttons for the page's look. Switching is saved and undoable like any edit. */
export function ThemePicker() {
  const theme = resolveTheme(useLayoutStore((s) => s.theme))
  const ready = useLayoutStore((s) => s.status === 'ready')
  const setTheme = useLayoutStore((s) => s.setTheme)

  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-1 text-sm">
      <span aria-hidden className="mr-1 text-ink-soft">
        Theme
      </span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={theme === t.id}
          disabled={!ready}
          onClick={() => void setTheme(t.id)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${theme === t.id ? 'border-ink/60 bg-lavender' : 'border-ink/25 bg-card hover:bg-butter'}`}
        >
          <span aria-hidden className={`swatch-${t.id} size-3.5 rounded-sm border border-ink/30`} />
          {t.label}
        </button>
      ))}
    </div>
  )
}
