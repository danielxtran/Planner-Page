import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { assertValidRows, getHomePage, savePageRows, savePageTheme, type Row } from './pages'
import { LOCAL_USER_ID } from './user'

const oneRow = (): Row[] => [
  {
    id: 'r1',
    columns: [
      { id: 'c1', width: 8, widgets: [{ id: 'w1', type: 'todo', config: {} }] },
      { id: 'c2', width: 4, widgets: [] },
    ],
  },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getHomePage', () => {
  it('creates a Home page from the defaults the first time', async () => {
    const page = await getHomePage(oneRow)

    expect(page).toEqual({
      id: expect.any(String),
      userId: LOCAL_USER_ID,
      name: 'Home',
      theme: 'graph',
      rows: oneRow(),
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    })
    expect(await db.pages.get(page.id)).toEqual(page)
  })

  it('returns the existing page afterwards instead of using the defaults', async () => {
    const first = await getHomePage(oneRow)
    const second = await getHomePage(() => [])
    expect(second).toEqual(first)
  })

  it('creates only one page when called twice at once', async () => {
    const [a, b] = await Promise.all([getHomePage(oneRow), getHomePage(oneRow)])
    expect(a.id).toBe(b.id)
    expect(await db.pages.count()).toBe(1)
  })
})

describe('savePageRows', () => {
  it('replaces the layout and bumps updatedAt', async () => {
    const page = await getHomePage(oneRow)
    vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'))
    const rows: Row[] = [{ id: 'r9', columns: [{ id: 'c9', width: 12, widgets: [] }] }]

    const saved = await savePageRows(page.id, rows)

    expect(saved).toEqual({ ...page, rows, updatedAt: '2026-01-02T09:00:00.000Z' })
    expect(await db.pages.get(page.id)).toEqual(saved)
  })

  it('saves an empty page', async () => {
    const page = await getHomePage(oneRow)
    expect((await savePageRows(page.id, [])).rows).toEqual([])
  })

  it('rejects a bad layout and leaves the stored one alone', async () => {
    const page = await getHomePage(oneRow)
    const bad = oneRow()
    bad[0].columns[1].width = 3
    await expect(savePageRows(page.id, bad)).rejects.toThrow('add up to 11')
    expect(await db.pages.get(page.id)).toEqual(page)
  })

  it('throws for a missing page', async () => {
    await expect(savePageRows('nope', [])).rejects.toThrow('Page not found')
  })
})

describe('savePageTheme', () => {
  it('changes only the theme and bumps updatedAt', async () => {
    const page = await getHomePage(oneRow)
    vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'))

    const saved = await savePageTheme(page.id, 'bujo')

    expect(saved).toEqual({ ...page, theme: 'bujo', updatedAt: '2026-01-02T09:00:00.000Z' })
    expect(await db.pages.get(page.id)).toEqual(saved)
  })

  it('rejects an empty theme name', async () => {
    const page = await getHomePage(oneRow)
    await expect(savePageTheme(page.id, ' ')).rejects.toThrow('required')
  })
})

describe('assertValidRows', () => {
  const withChange = (change: (rows: Row[]) => void) => {
    const rows = oneRow()
    change(rows)
    return () => assertValidRows(rows)
  }

  it('accepts a good layout', () => {
    expect(() => assertValidRows(oneRow())).not.toThrow()
  })

  it.each([
    ['widths not adding to 12', (r: Row[]) => (r[0].columns[0].width = 6), 'add up to 10'],
    ['a zero width', (r: Row[]) => (r[0].columns[0].width = 0), 'whole number'],
    ['a fractional width', (r: Row[]) => (r[0].columns[0].width = 7.5), 'whole number'],
    ['a row with no columns', (r: Row[]) => (r[0].columns = []), 'no columns'],
    ['a reused id', (r: Row[]) => (r[0].columns[1].id = 'w1'), 'used twice'],
    ['a missing id', (r: Row[]) => (r[0].id = ''), 'missing an id'],
    ['a widget with no type', (r: Row[]) => (r[0].columns[0].widgets[0].type = ''), 'no type'],
  ])('rejects %s', (_name, change, message) => {
    expect(withChange(change)).toThrow(message)
  })
})
