import { lazy, type ComponentType } from 'react'
import type { WidgetInstance } from '../storage/pages'
import { EmbedWidget } from './embed/EmbedWidget'
import { ImageWidget } from './image/ImageWidget'
import { StickyNotesWidget } from './sticky/StickyNotesWidget'
import { IMAGE_STARTERS, imageStarterConfig } from './image/imageConfig'
import { readTextConfig, TEXT_STARTERS, textStarterConfig, variantLabel } from './text/textConfig'
import { TextWidget } from './text/TextWidget'
import { TodoWidget } from './todo/TodoWidget'

// The notes editor (TipTap + ProseMirror) is most of the app's size, so it's
// split into its own file that only downloads once a page shows a notes widget.
// WidgetFrame wraps widgets in <Suspense> to show "Loading…" meanwhile.
const NotesWidget = lazy(() =>
  import('./notes/NotesWidget').then((m) => ({ default: m.NotesWidget })),
)
// Same for calendars: ical.js (and MSAL, on first Outlook use) only download when needed.
const CalendarWidget = lazy(() =>
  import('./calendar/CalendarWidget').then((m) => ({ default: m.CalendarWidget })),
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

/** One entry in "+ Add widget": a widget type with a particular starting look. */
export interface WidgetStarter {
  label: string
  description: string
  config: () => Record<string, unknown>
}

export interface WidgetDefinition {
  /** Stored in WidgetInstance.type. Never rename one: saved layouts refer to it. */
  type: string
  label: string
  /** Heading shown until the user renames the widget. */
  defaultTitle: string
  /** A default name that depends on the settings (a text block styled as a quote is "Quote"). */
  titleFor?: (config: Record<string, unknown>) => string
  description: string
  Component: ComponentType<WidgetProps>
  defaultConfig: () => Record<string, unknown>
  /**
   * Several starting looks for one type, each its own entry in the add menu.
   * Sharing one type means a block can switch look later without being recreated.
   */
  starters?: readonly WidgetStarter[]
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
  {
    type: 'text',
    label: 'Text block',
    defaultTitle: 'Text',
    titleFor: (config) => variantLabel(readTextConfig(config).variant),
    description: 'Styled text: quotes, callouts, labels, and sticky notes.',
    Component: TextWidget,
    defaultConfig: () => ({ ...textStarterConfig({}) }),
    starters: TEXT_STARTERS.map((s) => ({
      label: s.label,
      description: s.description,
      config: () => ({ ...textStarterConfig(s.config) }),
    })),
  },
  {
    type: 'image',
    label: 'Image',
    defaultTitle: 'Image',
    description: 'A photo or picture from your computer, with an optional frame and caption.',
    Component: ImageWidget,
    defaultConfig: () => ({ ...imageStarterConfig({}) }),
    starters: IMAGE_STARTERS.map((s) => ({
      label: s.label,
      description: s.description,
      config: () => ({ ...imageStarterConfig(s.config) }),
    })),
  },
  {
    type: 'stickies',
    label: 'Sticky notes',
    defaultTitle: 'Sticky notes',
    description: 'Jot quick thoughts, stick them aside, and look back through the pile.',
    Component: StickyNotesWidget,
    // Its own board, so two sticky widgets keep two separate piles.
    defaultConfig: () => ({ boardId: crypto.randomUUID() }),
  },
  {
    type: 'calendar',
    label: 'Calendar',
    defaultTitle: 'Calendar',
    description: 'The next few days from Canvas, Google, and Outlook, with tasks due.',
    Component: CalendarWidget,
    defaultConfig: () => ({}),
  },
  {
    type: 'embed',
    label: 'Embed',
    defaultTitle: 'Embed',
    description: 'A YouTube video, Spotify playlist, map, or public calendar.',
    Component: EmbedWidget,
    defaultConfig: () => ({ url: '' }),
  },
]

/** Every entry for the add menu: a type's starters, or the type itself if it has none. */
export function addMenuItems(): { type: string; starter: WidgetStarter }[] {
  return WIDGET_DEFINITIONS.flatMap((d) =>
    (d.starters ?? [{ label: d.label, description: d.description, config: d.defaultConfig }]).map(
      (starter) => ({ type: d.type, starter }),
    ),
  )
}

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
  const definition = getWidgetDefinition(widget.type)
  if (!definition) return 'Unknown widget'
  return definition.titleFor?.(widget.config) ?? definition.defaultTitle
}
