# Store listing drafts — Shtëpia.ime (L24)

Drafts for App Store Connect and Google Play Console, written 2026-10-21 from
what the code does today. **Nothing here has been submitted.** The owner
reviews every line; anything marked _OWNER_ is a business fact only the owner
can supply. Character limits are the ones the consoles enforced as of writing —
the console is the authority if they differ.

## 1. Listing text

| Field | Limit | Albanian (primary) | English |
| --- | --- | --- | --- |
| App name | 30 | Shtëpia.ime | Shtëpia.ime |
| Subtitle (Apple) | 30 | Shtëpi për shitje dhe me qira | Homes for sale and rent |
| Short description (Google) | 80 | Gjej, ruaj dhe vizito shtëpi në Shqipëri — në gjuhën tënde. | Find, save and visit homes in Albania — in your own language. |
| Keywords (Apple) | 100 | shtëpi,apartament,qira,shitje,banesë,vilë,tiranë,durrës,agjent,pasuri | home,apartment,rent,sale,albania,tirana,durres,villa,agent,property |

**Description (Albanian)**

> Shtëpia.ime të ndihmon të gjesh shtëpinë tënde në Shqipëri.
>
> • Kërko apartamente, shtëpi, vila, zyra, toka dhe ambiente biznesi, për shitje ose me qira, në listë ose në hartë.
> • Ruaj njoftimet që të pëlqejnë dhe kërkimet e tua; aplikacioni të tregon sa njoftime të reja përputhen që herën e fundit.
> • Shkruaji agjentit brenda aplikacionit, telefono ose dërgo mesazh në WhatsApp, dhe kërko një vizitë.
> • Nuk e gjen atë që kërkon? Posto çfarë shtëpie dëshiron dhe lëri agjentët të të gjejnë.
> • Je agjent? Publiko dhe ndrysho njoftimet, shëno kur janë shitur ose dhënë me qira, dhe menaxho vizitat.
> • Në 8 gjuhë: shqip, anglisht, gjermanisht, italisht, spanjisht, frëngjisht, polonisht dhe rusisht — për shqiptarët jashtë vendit dhe investitorët e huaj.
>
> Raporto një njoftim ose një përdorues dhe blloko kë nuk do të të shkruajë.

**Description (English)**

> Shtëpia.ime helps you find your home in Albania.
>
> • Search apartments, houses, villas, offices, land and commercial space for sale or rent, as a list or on a map.
> • Save listings and searches; the app shows how many more listings match than last time.
> • Message the agent in the app, call or WhatsApp them, and request a viewing.
> • Can't find it? Post the home you want and let agents find you.
> • Agents: publish and edit listings, mark them sold or rented, and manage viewings.
> • In 8 languages — Albanian, English, German, Italian, Spanish, French, Polish and Russian — for the diaspora and foreign buyers.
>
> Report a listing or a user, and block anyone you don't want to hear from.

Not claimed on purpose: email or push alerts (not built — L06, L27), paid
promotion (not built — L23), "verified" agents (no verification exists),
any number of listings or users.

- Category: _OWNER_ (suggested: Lifestyle; Apple has no Real Estate category, Google has "House & Home").
- Support URL, marketing URL, support email: _OWNER_ (blocked on the domain and mailbox, L16/L17).
- Privacy policy URL: `/privacy` on the production website (exists in both languages; update its contact line once L17 lands).
- Screenshots: take from a production build on a real phone (L18), not from the web app.

## 2. Apple — App Privacy ("nutrition label")

Source of truth: Apple's App Privacy Details page
(https://developer.apple.com/app-store/app-privacy-details/). Derived from the
tables and SDKs in this repo on 2026-10-21. No analytics, advertising or
crash-reporting SDK is installed, and nothing is used for tracking.

| Data type (Apple) | Collected? | Linked to the user | Used for tracking | Purpose | Where |
| --- | --- | --- | --- | --- | --- |
| Name | Yes | Yes | No | App functionality | `profiles.full_name` |
| Email address | Yes | Yes | No | App functionality | Supabase Auth |
| Phone number | Yes (optional) | Yes | No | App functionality | `profiles.phone`, `properties.contact_phone` |
| Photos or videos | Yes (agents' listing photos) | Yes | No | App functionality | Storage `property-images/<user id>/` |
| Other user content | Yes (listings, messages, viewing notes, wanted-home posts, reports) | Yes | No | App functionality | `properties`, `messages`, `viewings`, `wanted_homes`, `content_reports` |
| Search history | Yes (saved searches only) | Yes | No | App functionality | `saved_searches` |
| Product interaction | Yes (listing views, calls, WhatsApp taps, for the agent's dashboard) | Yes | No | App functionality, Analytics (first-party, shown to the listing's owner) | `property_activity` |
| User ID | Yes | Yes | No | App functionality | Supabase Auth |
| Location | **No** — the app never reads the device location (no location permission). Listing addresses are content, not the user's location. | | | | |
| Crash / diagnostics | **No** (no crash SDK, L26) | | | | |

Third parties that process data on our behalf: Supabase (database, auth,
storage), Anthropic (AI listing text, search parsing and translation, through
Supabase Edge Functions — only listing text and search phrases are sent),
Google and Apple (only when the user chooses their sign-in). Confirm the
Anthropic description matches the privacy policy before submitting.

Account deletion (guideline 5.1.1(v)): Profile → "Delete account", both apps,
`delete-account` Edge Function.

## 3. Google Play — Data safety

Same inventory, in Google's terms. Answers to verify in the console:

- Data collected: Personal info (name, email, phone — optional), Photos, Messages (in-app messages), App activity (in-app search history: saved searches; other actions: listing views/calls for owners' dashboards), App info and performance: **none**, Location: **none**, Device or other IDs: none beyond the account user ID.
- Shared with third parties: **No** (service providers processing on our behalf are not "sharing" under Google's definition — confirm in the console help).
- Encrypted in transit: Yes (HTTPS to Supabase only).
- Users can request deletion: Yes, in the app (Profile → Delete account) and on the website profile page.
- Required vs optional: email and name are required to sign up; phone is optional.

## 4. Permissions shown to users

| Permission | Platform | Text | Why |
| --- | --- | --- | --- |
| Photos | iOS (`NSPhotoLibraryUsageDescription` via the `expo-image-picker` plugin) | "Shtëpia.ime needs access to your photos so you can add them to a listing." | Listing photos |
| Microphone | — | disabled in `app.json` (`microphonePermission: false`) | not needed |
| Camera | both | not requested: `cameraPermission: false` (no iOS purpose string; Android `CAMERA` removed) — checked with `expo prebuild` 2026-10-21 | the app only picks existing photos/videos |
| Storage (Android ≤ 12) | Android | `READ`/`WRITE_EXTERNAL_STORAGE` with `maxSdkVersion 32`, added by the picker | photo picking on older Android |
| Location, contacts, notifications | — | not requested | — |

## 5. Reviewer access (Apple 2.1, Google "App access")

Both stores need a working sign-in for review. Plan, to execute only when a
build is submitted:

1. Create two fresh accounts on the production project, one Klient and one
   Agjent, with addresses on the owner's domain (needs L15 SMTP so the
   confirmation code arrives) — not the existing `claude-test@shtepia.dev`
   (L30).
2. Give the Agjent one clearly fictional listing marked as a review listing,
   and delete it after approval.
3. Put the credentials only in the consoles' review-notes fields, never in
   this repository.
4. Review note to include: what the app does, where Report/Block are (listing
   page "Report"; chat menu "Block"), where account deletion is, and that
   there are no in-app purchases.

## 6. Payments note for review

There is no purchase screen in either app today, so no in-app purchase is
needed for this version. When listing promotion or agency plans are sold
(DECISIONS.md M1): Apple 3.1.1 requires in-app purchase for features unlocked
inside the app, and Google Play has an equivalent billing policy. Selling them
only on the website and not linking to that from the app is the plan recorded
in the tracker; confirm the exact rules for the countries involved before
building it (L23).
