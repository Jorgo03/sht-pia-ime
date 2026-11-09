# Competitor analysis: Shtëpia.ime and Catia.al

Investigated 2026-11-09. **Analysis only: no application code, database or setting was changed for this report.**

## 1. The short answer

**Catia.al is the bigger marketplace today. Shtëpia.ime is the better product.**

| | Catia.al | Shtëpia.ime |
|---|---|---|
| Live homes | About 15,900 listing pages; 6,562 rentals in search | **2 active listings** |
| Professionals | 100 agencies, 197 agents | 7 agent accounts |
| Downloads | Google Play 10K+ (4.0 from 30 reviews); App Store 5.0 from 9 | Not in the stores yet |
| Built on | WordPress 6.3 with the Houzez real estate theme | Purpose-built Expo app on Supabase |
| App last updated | 14 Aug 2024 (version 3.1, App Store) | Updated daily |
| Languages | English interface; Albanian listing text | 8 languages, listings translated |
| Real-time chat | Advertised, not visible on the website | Built and in use |

The gap that matters most is **homes, not features**. No feature below will beat 15,900 listings. Getting agencies onto the platform is the main job, and most of the priorities in section 7 follow from that.

## 2. How far each finding can be trusted

**Catia.al**
- **CONFIRMED:** seen on its public website on 2026-11-09, or in its store screenshots.
- **ADVERTISED:** only claimed in store text. I looked and did not find it working.
- **UNAVAILABLE:** needs an account or the native app. I did not register, log in, submit a form or install anything. So its dashboards, listing form, in-app chat and notifications could not be inspected.

Only public pages were read. A real sample was small: the home page, search results, 1 listing, the agency and agent lists, 1 agent page, the comparison page, sitemaps and store pages.

**Shtëpia.ime**
- **Live data:** read from your production database.
- **Automated tests:** 275 browser tests against a simulated backend, 502 unit tests.
- **Owner-seen:** you have used it on your iPhone and Android.
- **Not verified:** I have no phones, so push delivery and real-device behaviour are unproven. Real email delivery is still untested.

Scores for Catia's native app therefore rest on its website and screenshots.

## 3. What Catia.al offers

| # | Area | Finding | Evidence |
|---|---|---|---|
| 1 | Registration, login | Username and password, or Google. Register asks for account type. Password reset by email | CONFIRMED (forms seen, not used) |
| 2 | User profiles | Logged-in menu seen in screenshot; profile contents not seen | UNAVAILABLE |
| 3 | Agent accounts | Public agent page: photo, agency, phone, listing count, sort, reviews tab | CONFIRMED |
| 4 | Agency accounts | Account type "Agency" exists; 100 agency pages | CONFIRMED |
| 5 | Client accounts | Account type "Buyer" exists | CONFIRMED (not used) |
| 6 | Property publishing | "Add Property" in app menu; form not reachable without an account | UNAVAILABLE |
| 7 | Editing, management | Not reachable | UNAVAILABLE |
| 8 | Search | Status, type, city, bedrooms, price | CONFIRMED |
| 9 | Advanced filters | Bathrooms, area, property ID, price range, 14 amenities | CONFIRMED |
| 10 | Categories | Commercial, Farm House, Garage, Hotels, Land, Office, Residential (Apartment, Condo, Multi Family, Single Family, Studio, Villa), Shop. Status: Rent, Sale, Foreclosure, New Construction, New Listing, Open House, Reduced Price, Resale, Sold | CONFIRMED |
| 11 | Listing details | Overview, description, details, features, ID, updated date, similar listings | CONFIRMED |
| 12 | Galleries | Photo grid with lightbox | CONFIRMED |
| 13 | Videos | Absent on the listing sampled | NOT VERIFIED |
| 14 | 3D tours | Store text only; absent on the listing sampled | ADVERTISED |
| 15 | Floor plans | Store text only; absent on the listing sampled | ADVERTISED |
| 16 | Maps | Website map on search results; app screenshots show price markers with a results panel | CONFIRMED |
| 17 | Location search | City list and a 50 km radius control | CONFIRMED |
| 18 | Favorites, saved | Favorites and "Save Search" controls; need login | CONFIRMED (not used) |
| 19 | Comparison | Compare buttons on cards and a compare page | CONFIRMED (not used) |
| 20 | In-app messaging | Store text only; website uses an email enquiry form | ADVERTISED |
| 21 | Notifications | Nothing public | UNAVAILABLE |
| 22 | Scheduling | "Schedule a Tour" with date, time, in-person or video chat | CONFIRMED (not submitted) |
| 23 | Contacting agents | Call, email, WhatsApp, enquiry form | CONFIRMED |
| 24 | Agent directory | 197 agents, search by name, category, city | CONFIRMED |
| 25 | Agency directory | 100 agencies, logos, some show listing counts | CONFIRMED |
| 26 | Market insights | Store text only; none on the website | ADVERTISED |
| 27 | Valuation | Store text only | ADVERTISED |
| 28 | Sales history | Store text only | ADVERTISED |
| 29 | Neighbourhood | Store text only | ADVERTISED |
| 30 | Recommendations | Store text only; needs an account | ADVERTISED |
| 31 | Sharing | WhatsApp, Facebook, Twitter, Pinterest, LinkedIn, email | CONFIRMED |
| 32 | Accessibility | Developer declares nothing on the App Store; 63 of 74 images had no alt text on the page sampled | CONFIRMED (one page) |
| 33 | Performance | Website answers fast (0.27 s), listing page loaded 80 files, about 6 MB. Native app not measured | CONFIRMED (website) |
| 34 | Security, privacy | HTTPS and standard headers present. Publicly reports PHP 7.4.33, which no longer gets security fixes, and WordPress 6.3.14. App Store: location data may be used for tracking | CONFIRMED (headers only; nothing probed) |

**Quality problems seen on Catia.al**
- "Chicago" is in its Albanian city list; "New Costruction" and "tennant" are misspelled.
- A viewing time list runs 10:00 am, 10:15 pm, 10:30 pm, 12:00 pm, which looks like a bug.
- A "Jepet me qira" rental was categorised as Land at €100,000.
- Many listings on one agent's page were 2 years old.
- Sampled agent and listing reviews were all at 0.

## 4. What your app has today

**Roles:** Klient (buyer) and Agjent (agent), plus a moderator list with **0 moderators** assigned.

**Size:** 34 route files, 29 database tables, all with row-level security, 60 migrations, 11 backend functions.

**Live usage:** 21 profiles, 2 active listings, 4 conversations, 6 messages, 1 saved search, 1 favourite, 1 lead, 0 viewings, 0 wanted homes, 0 payments. Most features are built but have barely been used by real people yet.

## 5. Feature comparison

| Feature | Catia.al | My app | Difference |
|---|---|---|---|
| Email and password | FULLY (seen) | FULLY | Equal |
| Google sign-in | FULLY (seen) | FULLY | Equal |
| Apple sign-in | NOT VERIFIED | PARTIALLY | Provider off in Supabase; button handles that |
| LinkedIn, email code | NOT IMPLEMENTED | PARTIALLY | Code email not yet proven to reach people |
| Account types | FULLY (Agent, Agency, Buyer) | PARTIALLY | No real agency account |
| Agency with several agents | NOT VERIFIED | NOT IMPLEMENTED | **Gap.** Only an agency name on each agent |
| Listing form | NOT VERIFIED | FULLY | Wizard, photos, translation |
| Edit, sold or rented, analytics | NOT VERIFIED | FULLY | Likely your strength |
| Search and sorting | FULLY | FULLY | Equal |
| Listing reference search | FULLY | FULLY | Equal |
| Zone search | PARTIALLY | FULLY | You are stronger |
| Amenity filters | FULLY (14) | NOT IMPLEMENTED | **Gap.** Stored on listings, not searchable |
| Status filters (new build, reduced) | PARTIALLY | NOT IMPLEMENTED | Gap |
| Property types | FULLY (14) | PARTIALLY (7) | No studio, hotel, shop, farm |
| Listing detail | FULLY | FULLY | Yours has price per m², publisher card |
| Listing video | NOT VERIFIED | PARTIALLY | **Bug: uploaded, never shown on any screen** |
| 3D tours | NOT VERIFIED | NOT IMPLEMENTED | Advertised only |
| Floor plans | NOT VERIFIED | PARTIALLY | Code exists; no page uses it |
| Map with price markers | FULLY | FULLY | Equal |
| Radius or near me | FULLY | NOT IMPLEMENTED | **Gap** |
| Favorites | FULLY | FULLY | Equal |
| Saved searches | FULLY | PARTIALLY | Created in one place only; alerts below |
| Search alerts | NOT VERIFIED | PARTIALLY | **Email alerts built but not running** |
| Comparison | FULLY | FULLY | Yours marks the best value |
| "Wanted home" posts | NOT IMPLEMENTED | FULLY | You are stronger |
| Real-time chat | NOT VERIFIED | FULLY | You are stronger on what is visible |
| Blocking, reporting | NOT VERIFIED | FULLY | Yours exists; no moderators yet |
| Notification centre, push | NOT VERIFIED | PARTIALLY | Built; phone delivery unproven |
| Viewing requests | FULLY | FULLY | Yours has manage screen |
| Video-chat viewings | PARTIALLY | NOT IMPLEMENTED | Small gap |
| Call, WhatsApp | FULLY | FULLY | Equal |
| Agent and agency directory | FULLY | FULLY | Catia far larger |
| Reviews | PARTIALLY (forms, 0 seen) | NOT IMPLEMENTED | Gap |
| Market insights, valuation | NOT VERIFIED | NOT IMPLEMENTED | Advertised only |
| Sales history | NOT VERIFIED | NOT APPLICABLE | No Albanian data source |
| Neighbourhood information | NOT VERIFIED | NOT IMPLEMENTED | Advertised only |
| Recommendations | NOT VERIFIED | NOT IMPLEMENTED | **"Sipas shijes suaj" just shows the newest homes** |
| Sharing | FULLY | FULLY | Yours uses the phone's share sheet |
| Multiple languages | NOT IMPLEMENTED | FULLY | **Your biggest edge for diaspora** |
| Listing translation | NOT IMPLEMENTED | FULLY | You are stronger |
| Agent performance reports | NOT VERIFIED | FULLY | You are stronger |
| Lead tracker | NOT VERIFIED | FULLY | You are stronger |
| Paid promotion | PARTIALLY | PARTIALLY | Yours has no provider or prices |
| Account deletion | NOT VERIFIED | FULLY | Required by the app stores |
| Android and iOS | FULLY (published) | PARTIALLY | Yours not yet in the stores |

## 6. Scores

Catia.al's native app could not be used, so its scores are less certain. Your phone behaviour was seen by you, not measured by me.

| Category | Catia.al | My app | Why |
|---|---:|---:|---|
| User experience | 5 | 8 | Catia is a stock template with data errors. Yours has loading, error and empty states throughout |
| Navigation | 6 | 8 | Catia's app hides much in a floating menu. Yours has a clear five-button bar |
| Visual design | 5 | 8 | Yours has its own identity. Catia looks like its theme |
| Performance | 6 | 7 | Catia's site answers fast but pages are heavy. Yours is untimed on phones |
| Property discovery | 8 | 5 | Catia wins on 15,900 homes, radius and amenities. Yours has better search, but 2 homes |
| Property publishing | 6 | 8 | Catia's form was unavailable, so low confidence. Yours has a full wizard with translation |
| Agent functionality | 6 | 8 | Catia gives agents reach. Yours gives them leads, viewings, analytics and reports |
| Client functionality | 6 | 7 | Catia has more to browse. Yours has chat, wanted homes and languages |
| Communication | 6 | 8 | Catia's public route is forms and WhatsApp. Yours adds real-time chat |
| Notifications | 3 | 7 | Catia shows nothing publicly. Yours is built, unproven on phones |
| Security | 5 | 7 | Catia reports outdated software. Yours has row-level security on all tables; leaked-password checks and Confirm email are off |
| Accessibility | 3 | 7 | Yours has automated checks. One contrast issue is open, awaiting your decision |
| Overall functionality | 7 | 7 | Catia is live and full. Yours is deeper but not yet launched |
| **Total** | **72 / 130** | **95 / 130** | Yours is ahead on quality. Catia is ahead on what a buyer can find today |

**You are stronger:** design, languages and translation, real-time chat, agent tools, wanted homes, accessibility, security foundations.

**Catia.al is stronger:** number of homes and agencies, being in both stores, amenity and radius search, agency pages, more property types.

## 7. Missing features, by priority

Effort assumes I build it, and means working days including tests.

### Priority 1: essential

| Feature | Why here | Effort | Cost | Backend |
|---|---|---|---|---|
| Publish to the App Store and Google Play | People cannot download it otherwise | 2–4 days plus review | Apple $99 a year, Google $25 once | No |
| Proven email delivery | Sign-up and alerts depend on it | Under 1 day | Free on Gmail now; a domain later | No |
| Show listing video | Agents upload it and nobody can watch it | 1 day | Storage only | No |
| Amenity filters | Data already exists; buyers expect it | 1–2 days | None | Small query change |
| Search alerts actually sent | The reason people come back | 2–3 days | Push free; email needs a provider | Yes, a schedule |
| Bulk listing import for agencies | Fastest way to close the 2 vs 15,900 gap | 4–6 days | None | Yes |

### Priority 2: high value

| Feature | Why here | Effort | Cost | Backend |
|---|---|---|---|---|
| Near me and radius search | Strong on a phone | 2–3 days | None | Yes |
| Real agency accounts | Offices manage teams; Catia has this | 5–8 days | None | Yes, new tables and rules |
| Honest "for you" recommendations | The current title overpromises | 2–3 days | None | Small |
| More property types and status tags | Studio, shop, new build, price reduced | 1–2 days | None | Yes |
| Save a search from Search | Today it lives in one screen only | 1 day | None | No |

### Priority 3: advanced, differentiating

| Feature | Why here | Effort | Cost | Backend |
|---|---|---|---|---|
| Price guide per area (labelled "estimate, not advice") | Would need real listing volume first | 4–6 days | None | Yes |
| Agent reviews | Builds trust; needs moderators and abuse rules | 3–5 days | None | Yes |
| Floor plans | Code partly exists | 2–3 days | None | No |
| Neighbourhood information | Schools, transport, distance to sea | 4–7 days | Maps data, possibly paid | Yes |

### Priority 4: optional for now

| Feature | Why here | Effort | Cost | Backend |
|---|---|---|---|---|
| 3D tours | Agents here rarely have them. A link field would be enough | 1 day for links | Capture costs fall on agents | Small |
| Video-chat viewings | Rarely essential; WhatsApp covers it | 1 day | None | Small |
| Sales history | No trustworthy Albanian data source | Not recommended | Not applicable | Not applicable |

## 8. Decisions

Features are decided a few at a time. Nothing is built without a YES here.

| Feature | Decision | Date | Notes |
|---|---|---|---|
| Explore cities, agencies directory, comparison | Already built at your request | 2026-11-08 | Tell me if you want any changed or removed |
| Show listing video | **YES** | 2026-11-09 | Built |
| Amenity filters | **YES** | 2026-11-09 | Built |
| Search alerts actually sent | **YES** | 2026-11-09 | Push first, email later. Built; live backend needs approval |
| Bulk listing import | Pending | | |
| Near me and radius search | Pending | | |
| Real agency accounts | Pending | | |
| Honest recommendations | Pending | | |
| More property types and status tags | Pending | | |
| Save a search from Search | Pending | | |
| Price guide per area | Pending | | |
| Agent reviews | Pending | | |
| Floor plans | Pending | | |
| Neighbourhood information | Pending | | |
| 3D tour links | Pending | | |
| Video-chat viewings | Pending | | |

Store publishing and email delivery are setup steps that need your accounts, so they are tracked separately from these feature decisions.

## Sources

- [Catia.al on the App Store](https://apps.apple.com/al/app/catia-al/id6450737032)
- [Catia.al on Google Play](https://play.google.com/store/apps/details?id=com.catia.al)
- [catia.al](https://catia.al/), its [agencies](https://catia.al/agencies-2/), [agents](https://catia.al/agents-2/), [search results](https://catia.al/search-results/?status%5B%5D=for-rent) and [sitemap](https://catia.al/wp-sitemap.xml)
- [mwm.ai app listing](https://mwm.ai/apps/catia-al/6450737032), a third-party page, used only for screenshot captions
