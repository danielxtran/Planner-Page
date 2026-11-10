import { describe, expect, it } from 'vitest'
import { assertValidRows, type Row, type WidgetInstance } from '../storage/pages'
import {
  addRow,
  addWidget,
  applyPreset,
  clampResize,
  findWidget,
  insertWidgetAfter,
  matchesPreset,
  moveRow,
  moveWidget,
  removeRow,
  removeWidget,
  resizeColumns,
  ROW_PRESETS,
  updateWidgetConfig,
} from './operations'

const widget = (id: string): WidgetInstance => ({ id, type: 'todo', config: {} })

/** Two rows: r1 = [c1: a, b | c2: c], r2 = [c3: (empty)] */
function sample(): Row[] {
  return [
    {
      id: 'r1',
      columns: [
        { id: 'c1', width: 6, widgets: [widget('a'), widget('b')] },
        { id: 'c2', width: 6, widgets: [widget('c')] },
      ],
    },
    { id: 'r2', columns: [{ id: 'c3', width: 12, widgets: [] }] },
  ]
}

/** Column contents as widget ids, e.g. { c1: ['a', 'b'], c2: ['c'] }. */
function contents(rows: Row[]) {
  return Object.fromEntries(
    rows.flatMap((r) => r.columns.map((c) => [c.id, c.widgets.map((w) => w.id)])),
  )
}

const widths = (rows: Row[], rowIndex: number) => rows[rowIndex].columns.map((c) => c.width)

describe('rows', () => {
  it('adds a valid full-width row at the end', () => {
    const rows = addRow(sample())
    expect(rows).toHaveLength(3)
    expect(widths(rows, 2)).toEqual([12])
    expect(() => assertValidRows(rows)).not.toThrow()
  })

  it('removes a row', () => {
    expect(removeRow(sample(), 'r1').map((r) => r.id)).toEqual(['r2'])
  })

  it('moves a row', () => {
    const rows = addRow(sample())
    const moved = moveRow(rows, 0, 2)
    expect(moved.map((r) => r.id)).toEqual([rows[1].id, rows[2].id, 'r1'])
  })

  it('never changes its input', () => {
    const rows = sample()
    const before = structuredClone(rows)
    addRow(rows)
    removeRow(rows, 'r1')
    moveRow(rows, 0, 1)
    applyPreset(rows, 'r1', [12])
    resizeColumns(rows, 'r1', 0, 2)
    addWidget(rows, 'c3', widget('z'))
    removeWidget(rows, 'a')
    moveWidget(rows, 'a', 'c3', 0)
    expect(rows).toEqual(before)
  })
})

describe('applyPreset', () => {
  it('every preset adds up to 12', () => {
    for (const preset of ROW_PRESETS) expect(preset.reduce((a, b) => a + b)).toBe(12)
  })

  it('changes widths and keeps existing columns and widgets', () => {
    const rows = applyPreset(sample(), 'r1', [8, 4])
    expect(widths(rows, 0)).toEqual([8, 4])
    expect(contents(rows)).toMatchObject({ c1: ['a', 'b'], c2: ['c'] })
  })

  it('adds new empty columns when there are more', () => {
    const rows = applyPreset(sample(), 'r1', [4, 4, 4])
    expect(widths(rows, 0)).toEqual([4, 4, 4])
    expect(rows[0].columns[2].widgets).toEqual([])
    expect(() => assertValidRows(rows)).not.toThrow()
  })

  it('moves widgets from dropped columns into the last remaining one', () => {
    const rows = applyPreset(sample(), 'r1', [12])
    expect(widths(rows, 0)).toEqual([12])
    expect(contents(rows)).toMatchObject({ c1: ['a', 'b', 'c'] })
  })

  it('reports which preset a row matches', () => {
    const [row] = sample()
    expect(matchesPreset(row, [6, 6])).toBe(true)
    expect(matchesPreset(row, [8, 4])).toBe(false)
    expect(matchesPreset(row, [4, 4, 4])).toBe(false)
  })
})

describe('resizeColumns', () => {
  it('moves the border between two columns', () => {
    expect(widths(resizeColumns(sample(), 'r1', 0, 2), 0)).toEqual([8, 4])
    expect(widths(resizeColumns(sample(), 'r1', 0, -3), 0)).toEqual([3, 9])
  })

  it('stops at the minimum width on either side', () => {
    expect(widths(resizeColumns(sample(), 'r1', 0, 99), 0)).toEqual([10, 2])
    expect(widths(resizeColumns(sample(), 'r1', 0, -99), 0)).toEqual([2, 10])
  })

  it('returns the same rows when nothing can change', () => {
    const rows = resizeColumns(sample(), 'r1', 0, 4)
    expect(resizeColumns(rows, 'r1', 0, 1)).toBe(rows)
    // No column to the right of the last one.
    expect(resizeColumns(rows, 'r1', 1, 1)).toBe(rows)
  })

  it('clampResize limits the change', () => {
    expect(clampResize(6, 6, 1)).toBe(1)
    expect(clampResize(6, 6, 10)).toBe(4)
    expect(clampResize(6, 6, -10)).toBe(-4)
    expect(clampResize(2, 10, -1)).toBe(0)
  })
})

describe('widgets', () => {
  it('adds a widget to the bottom of a column', () => {
    const rows = addWidget(sample(), 'c2', widget('z'))
    expect(contents(rows)).toMatchObject({ c2: ['c', 'z'] })
  })

  it('removes a widget', () => {
    expect(contents(removeWidget(sample(), 'a'))).toMatchObject({ c1: ['b'] })
  })

  it('finds a widget with its column, row, and position', () => {
    const found = findWidget(sample(), 'b')
    expect(found).toMatchObject({ index: 1, column: { id: 'c1' }, row: { id: 'r1' } })
    expect(findWidget(sample(), 'nope')).toBeNull()
  })

  it('reorders within a column', () => {
    expect(contents(moveWidget(sample(), 'a', 'c1', 1))).toMatchObject({ c1: ['b', 'a'] })
  })

  it('moves to another column at a position', () => {
    const rows = moveWidget(sample(), 'c', 'c1', 1)
    expect(contents(rows)).toMatchObject({ c1: ['a', 'c', 'b'], c2: [] })
  })

  it('moves into an empty column in another row', () => {
    const rows = moveWidget(sample(), 'a', 'c3', 0)
    expect(contents(rows)).toMatchObject({ c1: ['b'], c3: ['a'] })
  })

  it('clamps an out-of-range index to the end', () => {
    expect(contents(moveWidget(sample(), 'a', 'c2', 50))).toMatchObject({ c2: ['c', 'a'] })
  })

  it('ignores unknown widgets or columns', () => {
    const rows = sample()
    expect(moveWidget(rows, 'nope', 'c1', 0)).toBe(rows)
    expect(moveWidget(rows, 'a', 'nope', 0)).toBe(rows)
  })
})

describe('insertWidgetAfter', () => {
  it('puts the new widget right below the given one', () => {
    const next = insertWidgetAfter(sample(), 'a', widget('new'))
    expect(contents(next)).toEqual({ c1: ['a', 'new', 'b'], c2: ['c'], c3: [] })
    expect(() => assertValidRows(next)).not.toThrow()
  })

  it('ignores an unknown widget', () => {
    const rows = sample()
    expect(insertWidgetAfter(rows, 'nope', widget('new'))).toBe(rows)
  })
})

describe('updateWidgetConfig', () => {
  it("replaces one widget's settings and leaves the rest alone", () => {
    const rows = sample()
    const next = updateWidgetConfig(rows, 'b', { title: 'School' })
    expect(findWidget(next, 'b')?.widget.config).toEqual({ title: 'School' })
    expect(findWidget(next, 'a')?.widget).toBe(findWidget(rows, 'a')?.widget)
    // The other row wasn't touched, so it's the very same object.
    expect(next[1]).toBe(rows[1])
  })

  it('returns the same rows when the settings are unchanged or the widget is unknown', () => {
    const rows = updateWidgetConfig(sample(), 'a', { title: 'x' })
    expect(updateWidgetConfig(rows, 'a', { title: 'x' })).toBe(rows)
    expect(updateWidgetConfig(rows, 'nope', { title: 'y' })).toBe(rows)
  })
})
