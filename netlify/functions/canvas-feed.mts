// Netlify adapter for the Canvas feed proxy. All the logic is in server/canvasFeed.ts.
import { handleCanvasFeed } from '../../server/canvasFeed.js'

export default (request: Request) => handleCanvasFeed(request)

// Serve it at the same address the app calls on every host.
export const config = { path: '/api/canvas-feed' }
