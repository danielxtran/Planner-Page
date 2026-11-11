/**
 * Turns a link someone pasted into an embed (an <iframe> address) for a few
 * well-known services. Only these providers are allowed: an iframe of an
 * arbitrary site could be a fake login page wearing the hub's frame, so the
 * list is short and each address is rebuilt from the parts we recognize,
 * never passed through as typed.
 */

export interface Embed {
  provider: string
  src: string
  /** Width / height, for video-shaped embeds. */
  aspect?: number
  /** Fixed height in px, for players and lists that don't scale. */
  height?: number
}

const ID = /^[\w-]+$/

export const EMBED_PROVIDERS = [
  'YouTube',
  'Vimeo',
  'Spotify',
  'SoundCloud',
  'Google Maps',
  'Google Calendar',
] as const

export function toEmbed(input: string): Embed | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^(www|m)\./, '')
  const parts = url.pathname.split('/').filter(Boolean)

  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID.
  // youtube-nocookie.com is YouTube's privacy-friendlier player (no tracking cookies until you press play).
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null
    if (host === 'youtu.be') id = parts[0] ?? null
    else if (parts[0] === 'watch') id = url.searchParams.get('v')
    else if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] ?? null
    if (id && ID.test(id)) {
      return {
        provider: 'YouTube',
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        aspect: 16 / 9,
      }
    }
    const list = url.searchParams.get('list')
    if (parts[0] === 'playlist' && list && ID.test(list)) {
      return {
        provider: 'YouTube',
        src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`,
        aspect: 16 / 9,
      }
    }
    return null
  }

  // Vimeo: vimeo.com/123456
  if (host === 'vimeo.com' && /^\d+$/.test(parts[0] ?? '')) {
    return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${parts[0]}`, aspect: 16 / 9 }
  }

  // Spotify: open.spotify.com/(intl-xx/)track|album|playlist|episode|show|artist/ID
  if (host === 'open.spotify.com') {
    const rest = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts
    const [type, id] = rest
    const types = ['track', 'album', 'playlist', 'episode', 'show', 'artist']
    if (types.includes(type) && id && ID.test(id)) {
      return {
        provider: 'Spotify',
        src: `https://open.spotify.com/embed/${type}/${id}`,
        height: type === 'track' || type === 'episode' ? 152 : 352,
      }
    }
    return null
  }

  // SoundCloud: soundcloud.com/artist/track goes through its official player.
  if (host === 'soundcloud.com' && parts.length >= 2) {
    const track = `https://soundcloud.com/${parts.map(encodeURIComponent).join('/')}`
    return {
      provider: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track)}&visual=false`,
      height: 166,
    }
  }

  // Google Maps: only its "Share > Embed a map" links, which are already embed addresses.
  const pb = url.searchParams.get('pb')
  if (host === 'google.com' && url.pathname === '/maps/embed' && pb) {
    return {
      provider: 'Google Maps',
      src: `https://www.google.com/maps/embed?pb=${encodeURIComponent(pb)}`,
      aspect: 4 / 3,
    }
  }

  // Google Calendar: a public calendar's embed link (calendar.google.com/calendar/embed?src=…).
  if (
    host === 'calendar.google.com' &&
    url.pathname === '/calendar/embed' &&
    url.searchParams.get('src')
  ) {
    const params = new URLSearchParams()
    for (const key of ['src', 'ctz', 'mode']) {
      for (const value of url.searchParams.getAll(key)) params.append(key, value)
    }
    return {
      provider: 'Google Calendar',
      src: `https://calendar.google.com/calendar/embed?${params}`,
      aspect: 4 / 3,
    }
  }

  return null
}
