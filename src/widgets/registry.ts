import { lazy, type ComponentType } from 'react'
import type { WidgetInstance } from '../storage/pages'
import { TodoWidget } from './todo/TodoWidget'

// The notes editor (TipTap + ProseMirror) is most of the app's size, so it's
// split into its own file that only downloads once a page shows a notes widget.
// WidgetFrame wraps widgets in <Suspense> to show "Loading…" meanwhile.
const NotesWidget = lazy(() =>
  import('./notes/NotesWidget').then((m) => ({ default: m.NotesWidget })),
)

export interface WidgetProps {
  widget: WidgetInstance
  /**
   * Saves new settings for this widget. The layout is autosaved and the change
   * becomes one undo step named `label`. Widgets never write storage for their
   * settings themselves; the layout owns them.
   */
  onConfigChange: (label: string, config: Record<string, unknown>) => void
  /** Places a new widget directly below this one (e.g. "save this filter as a widget"). */
  onAddBelow: (widget: WidgetInstance, label: string) => void
}

export interface WidgetDefinition {
  /** Stored in WidgetInstance.type. Never rename one: saved layouts refer to it. */
  type: string
  label: string
  /** Heading shown until the user renames the widget. */
  defaultTitle: string
  description: string
  Component: ComponentType<WidgetProps>
  defaultConfig: () => Record<string, unknown>
}

/**
 * Every widget the hub can place. Adding a new kind of widget (calendar,
 * journal) means adding one entry here; the grid editor needs no changes.
 *
 * Any type can be placed any number of times, so a widget must keep its own
 * state in its `config` (or in records its config points to, like a note's id),
 * never in something shared by type. `defaultConfig` must return a fresh object
 * with fresh ids on every call. registry.test.ts checks this for every entry.
 */
export const WIDGET_DEFINITIONS: readonly WidgetDefinition[] = [
  {
    type: 'todo',
    label: 'To-do list',
    defaultTitle: 'To-do',
    description: 'Tasks with quick-add, priorities, due dates, and a saved filter.',
    Component: TodoWidget,
    defaultConfig: () => ({}),
  },
  {
    type: 'notes',
    label: 'Notes',
    defaultTitle: 'Notes',
    description: 'A page of rich text with headings, checklists, and links.',
    Component: NotesWidget,
    // The note's id is picked now, but its record is only written once you type.
    defaultConfig: () => ({ noteId: crypto.randomUUID() }),
  },
]

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find((d) => d.type === type)
}

export function createWidget(type: string, config?: Record<string, unknown>): WidgetInstance {
  const definition = getWidgetDefinition(type)
  if (!definition) throw new Error(`Unknown widget type: ${type}`)
  return { id: crypto.randomUUID(), type, config: config ?? definition.defaultConfig() }
}

/**
 * The name a widget goes by: the title the user gave it, else its type's default.
 * Any widget may keep a `title` string in its config; this is the one place that reads it.
 */
export function widgetTitle(widget: WidgetInstance): string {
  const title = widget.config.title
  if (typeof title === 'string' && title.trim()) return title.trim()
  return getWidgetDefinition(widget.type)?.defaultTitle ?? 'Unknown widget'
}
