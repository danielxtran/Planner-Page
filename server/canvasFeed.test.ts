// @vitest-environment node
// (Server code: test it in plain Node, the way it runs when deployed.)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedUrlProblem, handleCanvasFeed } from './canvasFeed.js'

const FEED = 'https://school.instructure.com/feeds/calendars/user_abc123.ics'
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'

const post = (body: unknown) =>
  handleCanvasFeed(
    new Request('http://localhost/api/canvas-feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn(async () => responses.shift() ?? new Response('nope', { status: 500 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('feedUrlProblem', () => {
  it('accepts a Canvas feed link', () => {
    expect(feedUrlProblem(FEED)).toBeNull()
    expect(feedUrlProblem('https://canvas.school.edu/feeds/calendars/user_X-1.ics')).toBeNull()
  })

  it.each([
    ['not a URL', 'hello'],
    ['plain http', 'http://school.instructure.com/feeds/calendars/user_a.ics'],
    ['an IP address', 'https://169.254.169.254/feeds/calendars/user_a.ics'],
    ['IPv6', 'https://[::1]/feeds/calendars/user_a.ics'],
    ['localhost', 'https://localhost/feeds/calendars/user_a.ics'],
    ['a one-word host', 'https://intranet/feeds/calendars/user_a.ics'],
    ['another path', 'https://school.instructure.com/api/v1/users/self'],
    ['a password in the link', 'https://a:b@school.instructure.com/feeds/calendars/user_a.ics'],
    ['an odd port', 'https://school.instructure.com:8443/feeds/calendars/user_a.ics'],
  ])('refuses %s', (_name, url) => {
    expect(feedUrlProblem(url)).not.toBeNull()
  })

  it('honors CANVAS_ALLOWED_HOSTS when set', () => {
    vi.stubEnv('CANVAS_ALLOWED_HOSTS', 'osu.instructure.com')
    expect(feedUrlProblem(FEED)).toMatch(/not allowed/)
    expect(feedUrlProblem('https://osu.instructure.com/feeds/calendars/user_a.ics')).toBeNull()
  })
})

describe('handleCanvasFeed', () => {
  it('passes a feed through', async () => {
    const fetchMock = stubFetch(new Response(ICS, { status: 200 }))
    const response = await post({ url: FEED })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(ICS)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledWith(FEED, expect.objectContaining({ redirect: 'manual' }))
  })

  it('only takes POST with a valid link, and fetches nothing otherwise', async () => {
    const fetchMock = stubFetch()
    const get = await handleCanvasFeed(new Request('http://localhost/api/canvas-feed'))
    expect(get.status).toBe(405)
    expect((await post({ url: 'https://evil.example/' })).status).toBe(400)
    expect((await post({})).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows a redirect to another feed link, but not to anywhere else', async () => {
    const next = 'https://other.instructure.com/feeds/calendars/user_abc123.ics'
    stubFetch(
      new Response(null, { status: 302, headers: { location: next } }),
      new Response(ICS, { status: 200 }),
    )
    expect((await post({ url: FEED })).status).toBe(200)

    stubFetch(new Response(null, { status: 302, headers: { location: 'https://10.0.0.1/admin' } }))
    const refused = await post({ url: FEED })
    expect(refused.status).toBe(502)
    expect(await refused.text()).toMatch(/redirected somewhere unexpected/)
  })

  it('refuses something that is not a calendar', async () => {
    stubFetch(new Response('<html>Log in</html>', { status: 200 }))
    expect(await (await post({ url: FEED })).text()).toMatch(/didn't send a calendar/)
  })

  it('refuses a feed that is too large', async () => {
    stubFetch(new Response(`BEGIN:VCALENDAR${'x'.repeat(3 * 1024 * 1024)}`, { status: 200 }))
    expect(await (await post({ url: FEED })).text()).toMatch(/too large/)
  })

  it('explains a feed link Canvas rejects', async () => {
    stubFetch(new Response('', { status: 404 }))
    expect(await (await post({ url: FEED })).text()).toMatch(/copy a fresh one/)
  })
})
