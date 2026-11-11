import { describe, expect, it } from 'vitest'
import { toEmbed } from './embeds'

describe('toEmbed', () => {
  it.each([
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    [
      'https://youtube.com/shorts/abc_DEF-123',
      'https://www.youtube-nocookie.com/embed/abc_DEF-123',
    ],
    [
      'https://www.youtube.com/playlist?list=PL123abc',
      'https://www.youtube-nocookie.com/embed/videoseries?list=PL123abc',
    ],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    [
      'https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x',
      'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    ],
    [
      'https://www.google.com/maps/embed?pb=!1m18!1m12',
      'https://www.google.com/maps/embed?pb=!1m18!1m12',
    ],
  ])('embeds %s', (input, src) => {
    expect(toEmbed(input)?.src).toBe(src)
  })

  it('keeps only known calendar settings', () => {
    const embed = toEmbed(
      'https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&ctz=America%2FNew_York&evil=1',
    )
    expect(embed?.src).toBe(
      'https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&ctz=America%2FNew_York',
    )
  })

  it('sizes players: video by shape, Spotify tracks short', () => {
    expect(toEmbed('https://youtu.be/abc')?.aspect).toBeCloseTo(16 / 9)
    expect(toEmbed('https://open.spotify.com/track/abc')?.height).toBe(152)
  })

  it.each([
    ['another site', 'https://evil.example/watch?v=abc'],
    ['a look-alike host', 'https://youtube.com.evil.example/watch?v=abc'],
    ['plain http', 'http://www.youtube.com/watch?v=abc'],
    ['a strange video id', 'https://youtu.be/abc"onload="x'],
    ['a normal Maps link', 'https://www.google.com/maps/place/Ohio+Stadium'],
    ['javascript', 'javascript:alert(1)'],
    ['not a link', 'cats'],
  ])('refuses %s', (_name, input) => {
    expect(toEmbed(input)).toBeNull()
  })
})
