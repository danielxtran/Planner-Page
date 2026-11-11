/// <reference types="vite/client" />

// Settings read from .env.local (see .env.example). Every VITE_ variable is
// copied into the browser bundle, so only public values belong here: OAuth
// client IDs are designed to be public; client secrets are not, and this app has none.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_MICROSOFT_CLIENT_ID?: string
}
