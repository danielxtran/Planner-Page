import { describe, expect, it } from 'vitest'
import { assertValidRows, type Row } from '../storage/pages'
import { createWidget, WIDGET_DEFINITIONS } from './registry'

/**
 * Any widget type can be placed as many times as you like (two to-do lists,
 * three notes, a wall of photos later). That only works if each placed widget
 * keeps its own state in its own config, so this checks every registered type,
 * including ones added in the future.
 */
describe.each(WIDGET_DEFINITIONS.map((d) => [d.type]))('the %s widget', (type) => {
  it('can be placed twice on one page with separate settings', () => {
    const first = createWidget(type)
    const second = createWidget(type)

    expect(first.id).not.toBe(second.id)
    // Not one shared object: changing one copy's settings must never change the other's.
    expect(first.config).not.toBe(second.config)
    // Any id inside the settings (like a note's id) must be different per copy too.
    const ids = (config: Record<string, unknown>) =>
      Object.entries(config).filter(([key]) => key.endsWith('Id'))
    for (const [key, value] of ids(first.config)) expect(second.config[key]).not.toBe(value)

    const rows: Row[] = [{ id: 'r', columns: [{ id: 'c', width: 12, widgets: [first, second] }] }]
    expect(() => assertValidRows(rows)).not.toThrow()
  })
})
