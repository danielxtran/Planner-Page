# Calendar setup

The calendar widget reads Canvas, Google, and Outlook calendars. It only ever
reads them; nothing is changed in your calendars. Canvas works with no setup.
Google and Outlook each need a free "app ID" that identifies Planner Hub to them.
That's about 10 minutes each, once.

None of this needs a credit card, and nothing here is a secret. The IDs go in
`.env.local`, which git ignores, but they'd be safe to commit too: they're built
into the page and are meant to be public. **Never add a client secret.** Planner
Hub doesn't use one, and anything in a `VITE_` variable is visible to every visitor.

## Canvas

1. In Canvas, open **Calendar**, then click **Calendar Feed** (bottom right).
2. Copy the link. It looks like `https://<school>.instructure.com/feeds/calendars/user_….ics`.
3. In the hub: calendar widget > **Calendars** > paste it under "Add a Canvas calendar".

The link works like a password for your calendar (anyone who has it can read
it), so the hub keeps it only in your browser. If it ever leaks, reset it in
Canvas from the same Calendar Feed box and paste the new one.

How it works: browsers won't let a page read a file from another site unless
that site allows it, and Canvas doesn't. So a small function
(`server/canvasFeed.ts`) fetches the feed and passes it back. It only fetches
links shaped like Canvas feeds, so nobody can use it to fetch anything else.
During `npm run dev` the same function runs inside Vite, so there's nothing extra
to start.

## Google Calendar

1. Go to <https://console.cloud.google.com/> and create a project (e.g. "Planner Hub").
2. **APIs & Services > Library**: find **Google Calendar API** and click **Enable**.
3. **APIs & Services > OAuth consent screen** (also called "Google Auth Platform"):
   - User type **External**. App name "Planner Hub", your email for support and contact.
   - Data access / scopes: add `.../auth/calendar.readonly`.
   - Audience: leave it in **Testing** and add your own Google account under **Test users**.
     Testing mode skips Google's app review; only listed test users can sign in (up to 100).
4. **APIs & Services > Credentials > Create credentials > OAuth client ID**:
   - Application type **Web application**.
   - **Authorized JavaScript origins**: add `http://localhost:5173`, and later your
     deployed address (e.g. `https://planner-hub.netlify.app`). No redirect URIs are needed.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into `.env.local`:
   `VITE_GOOGLE_CLIENT_ID=…`

Google's sign-in in the browser lasts about an hour and can only be renewed with
a click. So the widget shows its saved copy of your Google events right away, and
**Refresh** signs in again quietly (a popup may flash) when the hour is up.

## Outlook (Microsoft)

1. Go to <https://entra.microsoft.com/> (sign in with any Microsoft account) >
   **App registrations > New registration**.
   - Name "Planner Hub".
   - Supported account types: **Accounts in any organizational directory and personal
     Microsoft accounts**.
   - Redirect URI: platform **Single-page application (SPA)**, address
     `http://localhost:5173/auth-redirect.html`.
2. After it's created, under **Authentication**, add your deployed address too:
   `https://<your-site>/auth-redirect.html`.
3. **API permissions**: Microsoft Graph > Delegated > add `Calendars.Read`
   (`User.Read` is there already).
4. Copy the **Application (client) ID** from **Overview** into `.env.local`:
   `VITE_MICROSOFT_CLIENT_ID=…`

School or work Microsoft accounts may show "Need admin approval": your school's
IT decides which apps can read calendars. Personal accounts (outlook.com,
hotmail.com) always work.

## `.env.local`

Copy `.env.example` to `.env.local`, fill in the IDs, and restart `npm run dev`
(Vite only reads env files at startup).

## Deploying

Both free hosts work without changes:

- **Netlify**: connect the repo. `netlify.toml` sets the build and
  `netlify/functions/canvas-feed.mts` becomes the feed function.
- **Vercel**: import the repo. It detects Vite, and `api/canvas-feed.ts` becomes the function.

Either way, add `VITE_GOOGLE_CLIENT_ID` and `VITE_MICROSOFT_CLIENT_ID` in the
host's environment settings (they're baked in at build time), and add the
deployed address to Google's origins and Microsoft's redirect URIs as above.

Optional lock: set `CANVAS_ALLOWED_HOSTS` (e.g. `osu.instructure.com`) on the
host, and the feed function will only fetch from those Canvas sites.
