import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { readTextConfig, textStarterConfig, type TextConfig } from './textConfig'
import { TextWidget } from './TextWidget'

/** The widget with its settings in React state, standing in for the page layout. */
function StandaloneText({ start, log }: { start: Partial<TextConfig>; log: string[] }) {
  const [config, setConfig] = useState<Record<string, unknown>>({ ...textStarterConfig(start) })
  return (
    <>
      <TextWidget
        widget={{ id: 'w1', type: 'text', config }}
        onConfigChange={(label, next) => {
          log.push(label)
          setConfig(next)
        }}
        onAddBelow={() => {}}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}

const savedConfig = () => readTextConfig(JSON.parse(screen.getByTestId('config').textContent!))

describe('TextWidget', () => {
  it('saves typed text once, when you leave the box', () => {
    const log: string[] = []
    render(<StandaloneText start={{ variant: 'quote' }} log={log} />)
    const box = screen.getByRole('textbox', { name: 'Quote text' })

    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Be' } })
    fireEvent.change(box, { target: { value: 'Be kind' } })
    expect(log).toEqual([])

    fireEvent.blur(box)
    expect(log).toEqual(['edit text'])
    expect(savedConfig().text).toBe('Be kind')
  })

  it('throws away an edit on Escape', () => {
    const log: string[] = []
    render(<StandaloneText start={{ text: 'Keep me' }} log={log} />)
    const box = screen.getByRole('textbox', { name: 'Text text' })

    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Oops' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    fireEvent.blur(box)

    expect(log).toEqual([])
    expect(box).toHaveValue('Keep me')
  })

  it('saves a quote attribution separately', () => {
    const log: string[] = []
    render(<StandaloneText start={{ variant: 'quote' }} log={log} />)
    const who = screen.getByRole('textbox', { name: 'Quote attribution' })
    fireEvent.focus(who)
    fireEvent.change(who, { target: { value: 'Maya Angelou' } })
    fireEvent.blur(who)
    expect(savedConfig().attribution).toBe('Maya Angelou')
  })

  it('restyles from the Style panel, one saved change per click', () => {
    const log: string[] = []
    render(<StandaloneText start={{ variant: 'text' }} log={log} />)
    fireEvent.click(screen.getByRole('button', { name: 'Style Text' }))

    fireEvent.click(screen.getByRole('button', { name: 'Callout' }))
    // The widget is now named after its new look.
    expect(screen.getByRole('region', { name: 'Callout' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Icon 📌' }))
    fireEvent.click(screen.getByRole('button', { name: 'Typewriter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text Berry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Background Mint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Center' }))

    expect(savedConfig()).toMatchObject({
      variant: 'callout',
      icon: '📌',
      font: 'typewriter',
      color: 'berry',
      background: 'mint',
      align: 'center',
    })
    expect(log).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Text Berry' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: 'Style for Callout' })).toBeNull()
  })
})

describe('readTextConfig', () => {
  it('fills in defaults and drops unknown values', () => {
    expect(readTextConfig({ variant: 'poster', font: 'comic', text: 7, size: 'lg' })).toEqual(
      textStarterConfig({ size: 'lg' }),
    )
  })

  it('caps very long text', () => {
    expect(readTextConfig({ text: 'x'.repeat(5000) }).text).toHaveLength(2000)
  })
})
