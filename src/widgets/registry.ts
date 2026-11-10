import type { ComponentType } from 'react'
import type { WidgetInstance } from '../storage/pages'
import { TodoWidget } from './todo/TodoWidget'

export interface WidgetProps {
  widget: WidgetInstance
}

export interface WidgetDefinition {
  /** Stored in WidgetInstance.type. Never rename one: saved layouts refer to it. */
  type: string
  label: string
  description: string
  Component: ComponentType<WidgetProps>
  defaultConfig: () => Record<string, unknown>
}

/**
 * Every widget the hub can place. Adding a new kind of widget (notes,
 * calendar, journal) means adding one entry here; the grid editor needs no changes.
 */
export const WIDGET_DEFINITIONS: readonly WidgetDefinition[] = [
  {
    type: 'todo',
    label: 'To-do list',
    description: 'Tasks with quick-add, priorities, due dates, and filters.',
    Component: TodoWidget,
    defaultConfig: () => ({}),
  },
]

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find((d) => d.type === type)
}

export function createWidget(type: string): WidgetInstance {
  const definition = getWidgetDefinition(type)
  if (!definition) throw new Error(`Unknown widget type: ${type}`)
  return { id: crypto.randomUUID(), type, config: definition.defaultConfig() }
}
