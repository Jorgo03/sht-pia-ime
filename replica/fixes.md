# replica-entrepreneur: DuaShpi.al (run 1, 2026-10-14)

**Status: blocked at Step 1. Sample size: 0 reviews.** No fix plan or
positioning angle is written yet, because the skill's rule is that every
claim rests on real, linked, verbatim reviews, and none could be read.

## Why

This cloud environment's network policy refused every source the skill reads:
`duashpi.al`, `apps.apple.com`, `itunes.apple.com` (the App Store reviews
feed), `play.google.com`, `hn.algolia.com`. Web search worked, but it returns
summaries, which cannot be quoted verbatim.

To unblock: add those hosts under Allowed domains in this environment's
network settings (https://code.claude.com/docs/en/cloud-environments#network-access),
or paste reviews into `replica/reviews.csv` (`source,url,date,rating,text`).

## What was verified (via search, sources linked)

| fact | source |
| --- | --- |
| DuaShpi's iOS app: 5.0 from **6 ratings**, no written reviews found | https://apps.apple.com/al/app/duashpi-al/id6741591085 |
| Owners and agencies post **free** ads; listings can carry a **"Premium"** label | https://duashpi.al/en |
| Claims "largest real estate portal in Albania, over 100.000 active listings" (its own claim, unverified) | https://duashpi.al/en |
| App features: advanced filters, favourites, saved searches, real-time alerts | https://apps.apple.com/al/app/duashpi-al/id6741591085 |
| Partnership with a real-estate CRM provider | https://duashpi.al/en |
| Social reach: 2,364 Facebook likes, 4,585 Instagram followers | https://www.facebook.com/duashpi.al/ , https://www.instagram.com/duashpi.al/ |
| No DuaShpi pricing page, agency package or Premium price found in any result | — |
| Category context: MerrJep app reviewers complain search filters do not work | https://play.google.com/store/apps/details?id=al.merrjep |

With 6 ratings and no text, DuaShpi's own app reviews will stay thin even
once unblocked. The useful pool is the category: DuaShpi, MerrJep, Indomio.al
and Duashpi's Facebook comments, plus r/albania. `replica/themes.json` is
already tuned for it (fake or sold listings, agents posing as owners,
duplicates, missing prices, listers who never answer, paying to post), in
English and Albanian.

## Decisions the payment plans need from the owner

Monetisation is listed as an open question in CLAUDE.md. Pricing is
`/replica-launch`'s job, but these must be settled first:

1. What is paid: per-listing promotion (featured/boost), agency monthly plans,
   or both. Posting stays free (DuaShpi's model, and needed for supply).
2. Payment provider. Secondary sources say a business registered in Albania
   cannot open a standard Stripe account (payouts to Albania via Connect do
   exist); Stripe's official country list was not reachable to confirm.
   https://payrequest.io/fr/guides/accept-paypal-in-albania ,
   https://get.bandcamp.help/hc/en-us/articles/32854280223511 .
   The options depend on where FHO's company is registered.
3. Store rules: a paid boost bought inside the iOS/Android app is a digital
   good and must go through Apple/Google in-app purchase (15-30% fee);
   buying it on the website avoids that.
