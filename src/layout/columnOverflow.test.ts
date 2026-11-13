import { describe, expect, it } from 'vitest'
import { collapsedHeight, MIN_COLLAPSED_HEIGHT, OVERFLOW_TOLERANCE } from './columnOverflow'

describe('collapsedHeight', () => {
  it('cuts a column much taller than its neighbors to the tallest neighbor', () => {
    const heights = { a: 1200, b: 500, c: 400 }
    expect(collapsedHeight(heights, 'a')).toBe(500)
    expect(collapsedHeight(heights, 'b')).toBeNull()
    expect(collapsedHeight(heights, 'c')).toBeNull()
  })

  it("doesn't cut for a little extra, only past the tolerance", () => {
    expect(collapsedHeight({ a: 500 + OVERFLOW_TOLERANCE, b: 500 }, 'a')).toBeNull()
    expect(collapsedHeight({ a: 501 + OVERFLOW_TOLERANCE, b: 500 }, 'a')).toBe(500)
  })

  it('never cuts below the minimum, even beside a tiny neighbor', () => {
    expect(collapsedHeight({ a: 2000, b: 40 }, 'a')).toBe(MIN_COLLAPSED_HEIGHT)
  })

  it('leaves a column alone when it has no neighbors or no measurement yet', () => {
    expect(collapsedHeight({ a: 5000 }, 'a')).toBeNull()
    expect(collapsedHeight({ b: 100 }, 'a')).toBeNull()
  })
})
