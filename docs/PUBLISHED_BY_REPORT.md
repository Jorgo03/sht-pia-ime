# "Published by" on every listing: 2026-11-08

Every listing shows who published it. **Agent:** full name, office, phone.
**Client:** full name, phone, never an office.

## How it works

- **The publisher** is the listing's `owner_id`, the account that created it.
  It is not the person looking at the page. Existing database guards stop
  anyone changing it, including the owner, so editing cannot move it.
- **The account type** comes from the publisher's `profiles.role`, decided on
  the server.
- **Name** is `profiles.full_name` (one field; the app has no separate first
  and last name). **Office** is `profiles.agency_name`, the same field an agent
  fills in at sign-up. Nothing new is typed per listing.
- **Phone (owner decision):** the number on the listing if it has one, otherwise
  the account's registered number. Call and WhatsApp use the same number.
- **Client profiles stay private.** A listing cannot read one directly, so
  `public.listing_publisher(p_property)` (migration `20261108203236`, applied on
  the owner's approval) returns only `kind`, `full_name`, `phone` and
  `agency_name`, and only for an active listing, or for the listing's owner or
  a moderator. It adds no table or column.

Files: `src/features/properties/lib/publisher.js` (shared rule),
`hooks/use-listing-publisher.ts` and `app/property/[id].tsx` (phone app),
`src/features/properties/pages/PropertyDetail.jsx` (website), key
`detail.publishedBy` in all 8 languages.

Missing details: no name reads "Pronari" or "Agjent", no phone or office hides
that row, and a failed lookup falls back to what the listing already carries.

## The six scenarios

Run on the live database in a block that undoes every write
(`supabase/tests/rls_listing_publisher.sql`): **13/13**.

| Test | Result |
|---|---|
| 1 Agent, seen by another account: name, phone, office | Pass |
| 2 Client: name and phone; no office even when the profile holds one | Pass |
| 3 Two agents, two offices: each listing shows its own | Pass |
| 4 Another user cannot take a listing over; the owner cannot hand it over; editing keeps the publisher | Pass |
| 5 Missing name, phone or office: empty, no error | Pass |
| 6 Drafts hidden from others and signed-out visitors; an unrelated user still reads 0 rows of a client's profile | Pass |

Screens: e2e-expo X78–X80 and website F02-H6–H8, phone and desktop widths,
against the simulated backend; unit `tests/publisher.test.mjs`.

**Not tested:** a real iPhone or Android phone, and a real call from the phone
row. Layout was checked in a browser at phone width.

## Worth knowing

- This makes clients' full names public on their listings. There were 4 live
  client listings when it was applied, and one of those owners has no name on
  file. Consider a line in the listing form and the privacy policy saying the
  name and number are shown publicly.
- Supabase's security advisor now lists `listing_publisher` as callable without
  signing in. That is intended: signed-out visitors see listings too.
- The app stores one name field, so "First name + Last name" is whatever the
  person entered there.
