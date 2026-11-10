/**
 * Everything a text block can look like, as plain data. The widget's config
 * stores only the ids ('serif', 'berry'), so renaming a label or tweaking a
 * color here restyles every saved block without touching saved data.
 */

export const VARIANTS = [
  { id: 'text', label: 'Text' },
  { id: 'quote', label: 'Quote' },
  { id: 'callout', label: 'Callout' },
  { id: 'label', label: 'Cut-out label' },
  { id: 'sticky', label: 'Sticky note' },
] as const

/**
 * Fonts loaded from Google Fonts in index.html (sans is the system font).
 * `scale` evens out sizes: Caveat is drawn much smaller than other fonts at the same px.
 */
export const FONTS = [
  { id: 'hand', label: 'Handwritten', family: "'Caveat', cursive", scale: 1.35 },
  { id: 'marker', label: 'Marker', family: "'Patrick Hand', 'Comic Sans MS', cursive", scale: 1.1 },
  { id: 'serif', label: 'Serif', family: "'Lora', Georgia, serif", scale: 1 },
  {
    id: 'typewriter',
    label: 'Typewriter',
    family: "'Special Elite', 'Courier New', monospace",
    scale: 1,
  },
  { id: 'sans', label: 'Plain', family: 'system-ui, sans-serif', scale: 1 },
] as const

/** Base font sizes in rem, before the font's scale. */
export const SIZES = [
  { id: 'sm', label: 'S', rem: 0.95 },
  { id: 'md', label: 'M', rem: 1.15 },
  { id: 'lg', label: 'L', rem: 1.5 },
  { id: 'xl', label: 'XL', rem: 2.1 },
] as const

/**
 * Text colors. `ink` follows the theme; the rest are fixed, chosen dark enough
 * for 4.5:1 contrast on every background below in every theme. textStyles.test.ts
 * checks this against the real colors in theme.css, so add colors there with care.
 */
export const TEXT_COLORS = [
  { id: 'ink', label: 'Ink', css: 'var(--color-ink)', hex: null },
  { id: 'plum', label: 'Plum', css: '#5a3a72', hex: '#5a3a72' },
  { id: 'berry', label: 'Berry', css: '#7d2a4e', hex: '#7d2a4e' },
  { id: 'forest', label: 'Forest', css: '#284f3d', hex: '#284f3d' },
  { id: 'ocean', label: 'Ocean', css: '#22517a', hex: '#22517a' },
  { id: 'rust', label: 'Rust', css: '#763817', hex: '#763817' },
] as const

/** Backgrounds are theme colors, so they shift with the theme. 'none' shows the paper. */
export const BACKGROUNDS = [
  { id: 'none', label: 'None' },
  { id: 'card', label: 'White' },
  { id: 'butter', label: 'Butter' },
  { id: 'peach', label: 'Peach' },
  { id: 'rose', label: 'Rose' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'sky', label: 'Sky' },
  { id: 'mint', label: 'Mint' },
] as const

export const ALIGNS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
] as const

export type VariantId = (typeof VARIANTS)[number]['id']
export type FontId = (typeof FONTS)[number]['id']
export type SizeId = (typeof SIZES)[number]['id']
export type TextColorId = (typeof TEXT_COLORS)[number]['id']
export type BackgroundId = (typeof BACKGROUNDS)[number]['id']
export type AlignId = (typeof ALIGNS)[number]['id']

export function backgroundCss(id: BackgroundId): string | undefined {
  return id === 'none' ? undefined : `var(--color-${id})`
}

export function fontSizeCss(font: FontId, size: SizeId): string {
  const scale = FONTS.find((f) => f.id === font)?.scale ?? 1
  const rem = SIZES.find((s) => s.id === size)?.rem ?? 1.15
  return `${Math.round(rem * scale * 100) / 100}rem`
}
