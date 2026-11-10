import { describe, expect, it } from 'vitest'
// `?raw` gives the file's text, so this test checks the colors actually shipped.
import themeCss from '../../theme/theme.css?raw'
import { BACKGROUNDS, fontSizeCss, TEXT_COLORS } from './textStyles'

/** `--color-name: #hex` pairs from one block of CSS. */
function colorsIn(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  )
}

const bujoStart = themeCss.indexOf(":root[data-theme='bujo']")
const defaultTheme = colorsIn(themeCss.slice(0, bujoStart))
const themes: Record<string, Record<string, string>> = {
  graph: defaultTheme,
  bujo: { ...defaultTheme, ...colorsIn(themeCss.slice(bujoStart)) },
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

it('finds the bullet-journal block in theme.css', () => {
  expect(bujoStart).toBeGreaterThan(0)
})

describe.each(Object.entries(themes))('text colors in the %s theme', (_name, colors) => {
  // 'none' means the text sits on the page paper.
  const backgrounds = BACKGROUNDS.map((b) => (b.id === 'none' ? 'paper' : b.id))

  it('reads the theme colors it needs', () => {
    for (const name of [...backgrounds, 'ink']) expect(colors[name]).toMatch(/^#/)
  })

  it.each(TEXT_COLORS.map((c) => [c.label, c.hex]))(
    '%s has at least 4.5:1 contrast on every background',
    (_label, hex) => {
      const text = hex ?? colors.ink
      for (const background of backgrounds) {
        const ratio = contrast(text, colors[background])
        expect(ratio, `on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )
})

describe('fontSizeCss', () => {
  it('scales the handwritten font up so sizes look even', () => {
    expect(fontSizeCss('sans', 'md')).toBe('1.15rem')
    expect(fontSizeCss('hand', 'md')).toBe('1.55rem')
  })
})
