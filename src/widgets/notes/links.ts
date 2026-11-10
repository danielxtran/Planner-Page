/** Link kinds a note may contain. Anything else (javascript:, data:, file:) is refused. */
const SAFE_LINK = /^(https?:\/\/|mailto:)/i

export function isSafeLink(href: string): boolean {
  return SAFE_LINK.test(href)
}

/**
 * Turns what someone typed into a link address, or null if it isn't one.
 * "example.com" becomes "https://example.com" and "me@example.com" becomes a
 * mailto: link, because nobody types the https:// part.
 */
export function normalizeLink(input: string): string | null {
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  let href = text
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    href = /^[^@/]+@[^@/]+\.[^@/]+$/.test(text) ? `mailto:${text}` : `https://${text}`
  }
  if (!isSafeLink(href)) return null
  if (href.toLowerCase().startsWith('mailto:')) return href
  try {
    const url = new URL(href)
    // A bare word like "hello" would parse as https://hello; require a dot or localhost.
    return url.hostname.includes('.') || url.hostname === 'localhost' ? href : null
  } catch {
    return null
  }
}
