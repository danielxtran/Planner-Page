import type { Plugin } from 'vite'
import { handleCanvasFeed } from './canvasFeed.js'

/**
 * Runs the Canvas feed proxy inside `npm run dev`, at the same /api/canvas-feed
 * address it has when deployed, so calendars work locally without Netlify's or
 * Vercel's command-line tools.
 */
export function canvasFeedDevServer(): Plugin {
  return {
    name: 'planner-hub:canvas-feed',
    configureServer(server) {
      server.middlewares.use('/api/canvas-feed', (req, res) => {
        // Node's request -> a web Request, then the web Response -> Node's response.
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const request = new Request('http://localhost/api/canvas-feed', {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? '' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          })
          handleCanvasFeed(request)
            .then(async (response) => {
              res.statusCode = response.status
              response.headers.forEach((value, key) => res.setHeader(key, value))
              res.end(await response.text())
            })
            .catch(() => {
              res.statusCode = 500
              res.end('Feed proxy failed')
            })
        })
      })
    },
  }
}
