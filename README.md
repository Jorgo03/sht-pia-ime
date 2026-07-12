# Shtëpia.ime

Multilingual real-estate marketplace for Albania by **Future Home Orange** —
buyers/renters, agents and agencies, usable by the diaspora in 8 languages
(sq · en · de · it · es · pl · ru · fr).

## Architecture

| Layer | Tech |
|---|---|
| Frontend | Vite + React 19 + React Router v7 (`src/`, feature-first folders) |
| Styling | Tailwind CSS v4 + design tokens (`src/styles/theme.css`), light+dark |
| Backend | Supabase — Postgres (RLS on every table), Auth, Storage, Edge Functions |
| i18n | i18next, 8 locale files kept in sync; per-listing JSONB translations |
| Maps | Leaflet + OpenStreetMap |
| AI | Anthropic API via Supabase Edge Functions only (never client-side) |

The backend is **hosted on Supabase** (project `xzzzhlwmzotibrxdqmcm`) —
there is no local backend process. Edge Functions live in
`supabase/functions/`, SQL migrations in `supabase/migrations/`.

> **Legacy note:** `app/`, `components/`, `contexts/`, `data/` belong to an
> older Expo React-Native prototype that is not the shipping product. The
> live app is `src/`. See DECISIONS.md §11.

## Setup

1. Node 20+ and npm.
2. `npm install`
3. Create `.env.local` in the repo root:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon/publishable key>
   ```
   (Anon key only — service keys and the Anthropic key live exclusively in
   Supabase Edge Function secrets.)
4. `npm run dev` → http://localhost:5173

### One-click start (Windows)

Double-click **`start-backend.bat`** (or `start-frontend.bat`, same thing):
checks Node, installs deps if missing, verifies port 5173 is free and that
the hosted Supabase backend is awake, then starts the app. Stop with
**Ctrl+C** in the console window.

## Scripts

- `npm run dev` — dev server (port 5173)
- `npm run build` — production build to `dist/`
- `npm test` — unit tests (AI response sanitizers)

## Project docs

- `CLAUDE.md` — engineering conventions (read first)
- `shtepia-ime-overview.md` — data model + feature status
- `AUDIT.md` / `DESIGN_AUDIT.md` — audit history
- `DECISIONS.md` — pending human decisions & judgment-call log
- `design-system/MASTER.md` — visual design system
