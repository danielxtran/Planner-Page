import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { EmbedWidget } from './EmbedWidget'

function StandaloneEmbed({ url = '' }: { url?: string }) {
  const [config, setConfig] = useState<Record<string, unknown>>({ url })
  return (
    <EmbedWidget
      widget={{ id: 'w1', type: 'embed', config }}
      onConfigChange={(_label, next) => setConfig(next)}
      onAddBelow={() => {}}
    />
  )
}

describe('EmbedWidget', () => {
  it('embeds a pasted YouTube link in a sandboxed frame', () => {
    render(<StandaloneEmbed />)
    const input = screen.getByRole('textbox', { name: 'Link to embed' })
    fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } })
    fireEvent.submit(input)

    const frame = screen.getByTitle('YouTube embed')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation')
  })

  it('refuses a link from an unsupported site', () => {
    render(<StandaloneEmbed />)
    const input = screen.getByRole('textbox', { name: 'Link to embed' })
    fireEvent.change(input, { target: { value: 'https://example.com/page' } })
    fireEvent.submit(input)
    expect(screen.getByRole('alert')).toHaveTextContent("can't be embedded")
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('changes the link, or cancels and keeps the old one', () => {
    render(<StandaloneEmbed url="https://vimeo.com/76979871" />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Embed link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTitle('Vimeo embed')).toBeInTheDocument()
  })
})
