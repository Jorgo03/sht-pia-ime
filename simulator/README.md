# Shtëpia.ime simulator

The real app, every screen, running in a browser on made-up data. Nothing it
does reaches the real Supabase project: there is no network backend at all.

```
npm run build:simulator          # export + page, into dist-simulator/
node scripts/build-simulator.mjs --skip-export   # page only, after editing simulator/*
```

## How it works

- `scripts/build-simulator.mjs` runs `expo export -p web` with
  `EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co`, a host that is never
  contacted. It refuses to finish if a bundle names a real project.
- `simulator/demo-backend.js` is inlined at the top of the page, before the
  app's scripts. It wraps `window.fetch` and answers every request to that host:
  a small PostgREST (filters, `or`/`and`, order, paging, counts, embeds,
  insert/update/delete/upsert), sign-in, functions and storage, plus
  privacy rules modelled on the real RLS (a lead, a conversation or a paused
  listing is visible only to its owner).
- `simulator/seed.js` is the demo data: 20 listings across Albania, two
  agencies, conversations, viewings, buyer requests, leads, saved searches.
  The photos are drawn by `simulator/photos.mjs` (no real homes).
- Everything a visitor changes is kept in that browser's `localStorage`
  (`shtepia-sim:db:v1`). Bump `version` in `seed.js` when the data changes, so
  returning visitors get the new set.
- The page may load nothing from other sites, so the backend also answers the
  street lookup (OpenStreetMap's geocoder) from the demo city centres, draws map
  tiles as plain paper, and shows picked photos as `data:` URLs.

## Accounts

| | email | password |
|---|---|---|
| Agent (Elira Kola, Drita Prona) | `agjent@demo.al` | `demo1234` |
| Client (Arben Hoxha) | `klient@demo.al` | `demo1234` |

Any new email can sign up, and the email code is always `123456`. The
**Simulator** tab on the right edge signs in as either account in one tap,
signs out, or resets the data. Google, Apple and LinkedIn would leave the page,
so the simulator explains that instead.

## What is not simulated

Payments (Pricing), push notifications, real email, moderation tools, and
realtime updates: messages from the other side appear after reopening a
thread, not live. AI answers come from simple rules, and translations from a
small word list, not from the real Edge Functions.

## Tests

`tests/simulatorBackend.test.mjs` covers the pretend backend (`npm test`).
