// Vercel adapter for the Canvas feed proxy. All the logic is in server/canvasFeed.ts.
// Vercel serves files in api/ at /api/<name>, so this is /api/canvas-feed.
import { handleCanvasFeed } from '../server/canvasFeed.js'

export function POST(request: Request) {
  return handleCanvasFeed(request)
}
