/**
 * The one server piece of Planner Hub: fetches a Canvas calendar feed for the
 * browser. Browsers refuse to read a file from another site unless that site
 * allows it (CORS), and Canvas feeds don't, so this function fetches the feed
 * server-side and hands the text back to our own page.
 *
 * It's written against the web-standard Request/Response API, so the same code
 * runs on Netlify (netlify/functions/), Vercel (api/), and the Vite dev server.
 *
 * Safety: a function that fetches any URL it's given is an "open proxy" that
 * strangers could abuse to attack other sites or probe the host's network. This
 * one only fetches HTTPS URLs shaped like Canvas feeds, never IP addresses or
 * localhost, follows at most a few redirects (re-checking each), gives up after
 * 10 seconds, and refuses anything over 3 MB or that isn't a calendar.
 */

const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

/**
 * Optional extra lock: set CANVAS_ALLOWED_HOSTS (e.g. "osu.instructure.com") in
 * the host's environment settings to allow only those hosts. Not a secret.
 */
function allowedHosts(): string[] {
  const raw = typeof process !== 'undefined' ? process.env.CANVAS_ALLOWED_HOSTS : undefined
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

/** Why a URL isn't an acceptable Canvas feed, or null if it is. */
export function feedUrlProblem(input: string): string | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return 'That is not a web address'
  }
  if (url.protocol !== 'https:') return 'The feed link must start with https://'
  if (url.username || url.password) return 'The feed link must not contain a password'
  if (url.port && url.port !== '443') return 'The feed link must use the normal HTTPS port'
  const host = url.hostname.toLowerCase()
  // IPv4 (1.2.3.4), IPv6 ([::1]), and local names could point inside the host's network.
  if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) {
    return 'The feed link must use a domain name, not an IP address'
  }
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    !host.includes('.')
  ) {
    return 'The feed link must be a public Canvas address'
  }
  // Canvas feed links look like https://<school>/feeds/calendars/user_<token>.ics
  if (!/^\/feeds\/calendars\/[\w.-]+\.ics$/i.test(url.pathname)) {
    return "That doesn't look like a Canvas calendar feed link (…/feeds/calendars/….ics)"
  }
  const hosts = allowedHosts()
  if (hosts.length > 0 && !hosts.includes(host)) return 'That Canvas address is not allowed here'
  return null
}

function reply(status: number, body: string, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      // Feeds are private to one person: never let a CDN or browser cache keep a copy.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function handleCanvasFeed(request: Request): Promise<Response> {
  // POST, so the private feed link travels in the body instead of the URL,
  // where it would end up in server logs.
  if (request.method !== 'POST') return reply(405, 'Use POST')

  let feedUrl: unknown
  try {
    feedUrl = ((await request.json()) as { url?: unknown }).url
  } catch {
    return reply(400, 'Send JSON like {"url": "https://…"}')
  }
  if (typeof feedUrl !== 'string') return reply(400, 'Missing the feed link')
  const problem = feedUrlProblem(feedUrl)
  if (problem) return reply(400, problem)

  let url = feedUrl
  let upstream: Response | null = null
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      upstream = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'text/calendar, text/plain;q=0.5' },
      })
      const location = upstream.headers.get('location')
      if (upstream.status < 300 || upstream.status >= 400 || !location) break
      // Each redirect target has to pass the same checks as the original link.
      const next = new URL(location, url).toString()
      const redirectProblem = feedUrlProblem(next)
      if (redirectProblem)
        return reply(502, `Canvas redirected somewhere unexpected: ${redirectProblem}`)
      url = next
      upstream = null
    }
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    return reply(504, timedOut ? 'Canvas took too long to answer' : "Couldn't reach Canvas")
  }

  if (!upstream) return reply(502, 'Canvas redirected too many times')
  if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) {
    return reply(502, 'Canvas refused that feed link. It may have been reset; copy a fresh one.')
  }
  if (!upstream.ok) return reply(502, `Canvas answered with an error (${upstream.status})`)

  const declared = Number(upstream.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return reply(502, 'That calendar is too large')
  const text = await readCapped(upstream, MAX_BYTES)
  if (text === null) return reply(502, 'That calendar is too large')
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
    return reply(502, "Canvas didn't send a calendar")
  }
  return reply(200, text, 'text/calendar; charset=utf-8')
}

/** Reads a response body as text, stopping (null) if it goes past `max` bytes. */
async function readCapped(response: Response, max: number): Promise<string | null> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(all)
}
