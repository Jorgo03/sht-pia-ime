# Payments design: listing promotion + agency monthly plans

Decided by the owner, 2026-10-14: **both** paid products. Posting stays free
for owners and agents (DuaShpi's model, and what keeps listings coming in).

The database part is live (2026-10-14). Checkout, the webhook and the app
screens wait on the provider choice and the prices.

## The two products

**1. Promote a listing** (anyone who posted it: owner or agent)
- Bought per listing, for a fixed number of days (e.g. 7 or 30).
- While active: shown first in Home's featured slot and Explore results
  (rotated among promoted listings so one payer cannot pin the top), with a
  "Premium" badge, the label users already know from DuaShpi.
- Ends by itself on its end date. No auto-renew, so nobody is surprised by a
  charge.

**2. Agency plan** (agents only, monthly, cancel any time)
- Free tier: posting with a cap on active listings.
- Paid tiers raise the cap, include promotion credits each month, a verified
  agency badge on the agent profile, and listing analytics.
- One-click cancel; the plan runs to the end of the paid month.

Tier names, caps, credits and prices are **data in a `plans` table**, not
code, so they can be set and changed in `/replica-launch` without a release.

## Data (new tables only; existing tables untouched except one column)

| table | holds | who can read | who can write |
| --- | --- | --- | --- |
| `plans` | every sellable item: kind (`promotion` / `agency_subscription`), price in cents, currency, interval or duration, listing cap, credits | everyone | admins only (SQL) |
| `agency_subscriptions` | agent, plan, status (`active` `past_due` `canceled`), period end, provider reference (unique) | the agent | **server only** (payment webhook) |
| `listing_promotions` | property, buyer, plan, starts/ends, status, provider reference (unique) | the buyer | **server only** |
| `payment_events` | every provider event id (unique), for idempotency and audit | nobody via API | server only |
| `properties.promoted_until` | one nullable timestamp, set by the webhook, read by the feed sort | (existing rules) | server only |

Rules: nothing the app sends can mark something paid. Status changes only
come from the provider's signed webhook, handled once per event id (providers
retry). The active-listing cap is enforced in the database, not just hidden in
the UI.

## Server (Supabase Edge Functions)

- `create-checkout`: signed-in user + `plan_id` (+ `property_id` for a
  promotion) → checks ownership and role → returns the provider's hosted
  checkout URL. No card form in our app.
- `payments-webhook`: verifies the signature, stores the event id, updates
  subscription/promotion status and `promoted_until`.
- `manage-billing`: link to the provider's customer portal (cancel, invoices).

## Apps

- **My Listings**: "Promovo" on each listing → choose duration → checkout.
- **Agent dashboard**: "Plani im" (current plan, listings used / cap,
  credits left, renew date, cancel).
- **Feed**: promoted listings first + "Premium" badge, web and mobile.
- All strings through `t()`, keys added to all 8 locale files.

## Decided 2026-10-14

- **Company: Albania.** Provider shortlist: Paddle (merchant of record, lists
  Albania; confirm it onboards an Albania-registered seller) or a bank virtual
  POS (Raiffeisen raiAccept, BKT, Credins). The schema is provider-neutral.
- **Checkout: website only.** The apps show status; no in-app purchase.
- **Schema: applied** (`supabase/migrations/20261014214726_add_payments_foundation.sql`),
  21/21 offline, 14/14 live. Tables are empty until prices are set.

## Still open

- Which provider (needs the owner to contact Paddle and/or their bank).
- Prices, caps and credits (`/replica-launch`).
