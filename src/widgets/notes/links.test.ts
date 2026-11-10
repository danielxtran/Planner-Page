import { describe, expect, it } from 'vitest'
import { normalizeLink } from './links'

describe('normalizeLink', () => {
  it.each([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['example.com', 'https://example.com'],
    ['  canvas.osu.edu/courses  ', 'https://canvas.osu.edu/courses'],
    ['me@example.com', 'mailto:me@example.com'],
    ['mailto:me@example.com', 'mailto:me@example.com'],
    ['http://localhost:5173', 'http://localhost:5173'],
  ])('accepts %j', (input, expected) => {
    expect(normalizeLink(input)).toBe(expected)
  })

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,hi'],
    ['file:///C:/secret.txt'],
    ['hello'],
    ['two words.com'],
    [''],
  ])('refuses %j', (input) => {
    expect(normalizeLink(input)).toBeNull()
  })
})
