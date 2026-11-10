# Planner Hub

A cute, ADHD-friendly, easily customizable personal hub (Notion-like): filtered to-dos, notes, journal, read-only calendars, all arranged on a drag-and-drop grid. Personal project first, possibly a multi-user platform later. Portfolio + learning project, so explain non-obvious choices.

Plan: https://claude.ai/artifact/4UxKw6HnNEXTssUDRjFz3p
Getting started / build order: https://claude.ai/artifact/LStFSPnnFozn5h4iXFN1Kh

## Stack
- React + TypeScript + Vite, Tailwind with CSS variables for themes
- dnd-kit (grid), TipTap (notes/journal), Zustand (shared layout/theme state), date-fns
- Storage: Dexie on IndexedDB. No backend yet; Supabase later.
- Calendars (read-only): Google via Google Identity Services, Outlook via MSAL.js + Microsoft Graph, Canvas via iCal feed through one serverless function (CORS proxy)
- Hosting: Netlify or Vercel free tier. Free tiers only.

## Rules
- All reads/writes go through `src/storage/` modules. Components never import Dexie directly.
- Every record has `id` (UUID), `userId` (hard-coded for now), `createdAt`, `updatedAt`.
- Bump the Dexie schema version for any data shape change; write an upgrade.
- Layout is data: Page -> Rows -> Columns (widths in twelfths) -> stacked Widgets, stored as JSON. UI renders it.
- Tasks: priority (1-4), one category, optional due date, any number of custom tags.
- Every user action autosaves and is undoable.
- Look: simple scrapbook bullet journal, pastels, cozy. Check text contrast.
- No secrets in the repo. `VITE_` env vars end up in the browser bundle, so only public IDs go there.

## Build order
1. To-do list saved to Dexie  2. Priority/category/due date + filter bar  3. Grid editor
4. Saved filters as widgets  5. Notes + bullet-journal theme  6. Calendars (Canvas, Google, Outlook) + embeds
7. Journal  8. Custom tags, JSON backup export, polish
