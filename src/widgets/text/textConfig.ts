import {
  ALIGNS,
  BACKGROUNDS,
  FONTS,
  SIZES,
  TEXT_COLORS,
  VARIANTS,
  type AlignId,
  type BackgroundId,
  type FontId,
  type SizeId,
  type TextColorId,
  type VariantId,
} from './textStyles'

/** Text lives in the layout JSON, so it's capped to keep layouts small. Long writing belongs in Notes. */
export const MAX_TEXT_LENGTH = 2000

/** A text block's saved settings. */
export interface TextConfig {
  variant: VariantId
  text: string
  /** Quote only: who said it. */
  attribution: string
  /** Callout only: the emoji at the left. */
  icon: string
  font: FontId
  size: SizeId
  color: TextColorId
  background: BackgroundId
  align: AlignId
}

const DEFAULTS: TextConfig = {
  variant: 'text',
  text: '',
  attribution: '',
  icon: '💡',
  font: 'hand',
  size: 'lg',
  color: 'ink',
  background: 'none',
  align: 'left',
}

/** Starting looks offered in "+ Add widget". All are the same widget type, so a block can switch later. */
export const TEXT_STARTERS: { label: string; description: string; config: Partial<TextConfig> }[] =
  [
    {
      label: 'Text',
      description: 'A line or two in a handwritten font. Good for headings and doodle notes.',
      config: { variant: 'text', font: 'hand', size: 'xl' },
    },
    {
      label: 'Quote',
      description: 'A favorite quote with big quote marks and who said it.',
      config: { variant: 'quote', font: 'serif', size: 'lg', align: 'center', color: 'plum' },
    },
    {
      label: 'Callout',
      description: 'A highlighted box with an emoji, for reminders and key info.',
      config: { variant: 'callout', font: 'sans', size: 'md', background: 'butter' },
    },
    {
      label: 'Cut-out label',
      description: 'Words on a torn paper strip, like a scrapbook label.',
      config: { variant: 'label', font: 'typewriter', size: 'lg', background: 'peach' },
    },
    {
      label: 'Note card',
      description: 'A little square card of colored paper, slightly tilted.',
      config: { variant: 'sticky', font: 'marker', size: 'md', background: 'butter' },
    },
  ]

/** Reads stored settings field by field, falling back to defaults for anything missing or unknown. */
export function readTextConfig(config: Record<string, unknown>): TextConfig {
  const pick = <T extends string>(value: unknown, options: readonly { id: T }[], fallback: T) =>
    options.some((o) => o.id === value) ? (value as T) : fallback
  const text = (value: unknown, max: number, fallback = '') =>
    typeof value === 'string' ? value.slice(0, max) : fallback
  return {
    variant: pick(config.variant, VARIANTS, DEFAULTS.variant),
    text: text(config.text, MAX_TEXT_LENGTH),
    attribution: text(config.attribution, 200),
    icon: text(config.icon, 8, DEFAULTS.icon),
    font: pick(config.font, FONTS, DEFAULTS.font),
    size: pick(config.size, SIZES, DEFAULTS.size),
    color: pick(config.color, TEXT_COLORS, DEFAULTS.color),
    background: pick(config.background, BACKGROUNDS, DEFAULTS.background),
    align: pick(config.align, ALIGNS, DEFAULTS.align),
  }
}

/** A full config for a new block, from a starter. */
export function textStarterConfig(changes: Partial<TextConfig>): TextConfig {
  return { ...DEFAULTS, ...changes }
}

export function variantLabel(variant: VariantId): string {
  return VARIANTS.find((v) => v.id === variant)?.label ?? 'Text'
}
