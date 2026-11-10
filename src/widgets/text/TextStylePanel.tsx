import { ChoiceButton, OptionRow, StylePanel, SwatchButton } from '../StylePanel'
import type { TextConfig } from './textConfig'
import {
  ALIGNS,
  backgroundCss,
  BACKGROUNDS,
  FONTS,
  SIZES,
  TEXT_COLORS,
  VARIANTS,
} from './textStyles'

const CALLOUT_ICONS = ['💡', '⭐', '📌', '❗', '🌸', '✏️', '📚', '☕', '🎀', '🌙']

interface TextStylePanelProps {
  config: TextConfig
  name: string
  onChange: (changes: Partial<TextConfig>) => void
  onClose: () => void
}

/** The look of a text block. Each click saves right away and is one undo step. */
export function TextStylePanel({ config, name, onChange, onClose }: TextStylePanelProps) {
  return (
    <StylePanel label={`Style for ${name}`} onClose={onClose}>
      <OptionRow label="Style">
        {VARIANTS.map((v) => (
          <ChoiceButton
            key={v.id}
            pressed={config.variant === v.id}
            onClick={() => onChange({ variant: v.id })}
          >
            {v.label}
          </ChoiceButton>
        ))}
      </OptionRow>

      {config.variant === 'callout' && (
        <OptionRow label="Icon">
          {CALLOUT_ICONS.map((icon) => (
            <ChoiceButton
              key={icon}
              pressed={config.icon === icon}
              onClick={() => onChange({ icon })}
              label={`Icon ${icon}`}
            >
              <span aria-hidden>{icon}</span>
            </ChoiceButton>
          ))}
        </OptionRow>
      )}

      <OptionRow label="Font">
        {FONTS.map((f) => (
          <ChoiceButton
            key={f.id}
            pressed={config.font === f.id}
            onClick={() => onChange({ font: f.id })}
            // Each name is shown in its own font, so you can see it before picking.
            style={{ fontFamily: f.family, fontSize: f.scale > 1.2 ? '1.15rem' : undefined }}
          >
            {f.label}
          </ChoiceButton>
        ))}
      </OptionRow>

      <OptionRow label="Size">
        {SIZES.map((s) => (
          <ChoiceButton
            key={s.id}
            pressed={config.size === s.id}
            onClick={() => onChange({ size: s.id })}
            label={`Size ${s.label}`}
          >
            {s.label}
          </ChoiceButton>
        ))}
      </OptionRow>

      <OptionRow label="Text color">
        {TEXT_COLORS.map((c) => (
          <SwatchButton
            key={c.id}
            pressed={config.color === c.id}
            onClick={() => onChange({ color: c.id })}
            label={`Text ${c.label}`}
            color={c.css}
          />
        ))}
      </OptionRow>

      <OptionRow label="Background">
        {BACKGROUNDS.map((b) => (
          <SwatchButton
            key={b.id}
            pressed={config.background === b.id}
            onClick={() => onChange({ background: b.id })}
            label={`Background ${b.label}`}
            color={backgroundCss(b.id)}
          />
        ))}
      </OptionRow>

      <OptionRow label="Align">
        {ALIGNS.map((a) => (
          <ChoiceButton
            key={a.id}
            pressed={config.align === a.id}
            onClick={() => onChange({ align: a.id })}
          >
            {a.label}
          </ChoiceButton>
        ))}
      </OptionRow>
    </StylePanel>
  )
}
