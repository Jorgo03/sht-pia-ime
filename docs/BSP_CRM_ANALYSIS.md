# BSP CRM: what it does, and what Shtëpia.ime takes from it

2026-10-27. BSP CRM ("BSP Vision", by Best Software Solution) is a CRM for
real estate **agencies**: the agency's back office, sold per user. Shtëpia.ime
is a **marketplace** where buyers, renters, agents and owners meet. So the
useful part of BSP for us is the agent's working day: leads, follow-ups,
matching and the calendar. Not every module is worth copying.

## Sources

- App Store listing, read through Apple's public lookup API
  (`itunes.apple.com/lookup?id=1511139974&country=al`):
  - BSP CRM 4.2.3 (May 2026), first released May 2020;
  - free, Utilities/Productivity, English only;
  - 4.8 stars from 42 ratings;
  - 5 screenshots.
- bspvision.com: home page, the Real Estate CRM page, the Mobile App page,
  Pricing, and the ERA Albania case study.
- What we know comes from their marketing. Nobody here has used the product.

## What BSP offers

**In the mobile app** (from the screenshots and the Mobile App page):
1. A dashboard: "Hello", Today's Events, Today's Tasks.
2. A calendar of events: a month grid, then the day's events (meetings, calls).
3. Quick add, one tap: Event, Task, Visit, Contact, Lead, Opportunity, Property.
4. Sharing a property to Instagram, Instagram Stories, WhatsApp, Facebook and
   Twitter, plus WhatsApp messages to a lead.
5. Push notifications, e.g. "John Doe is assigned to you".
6. Notes, tasks, reminders, and editing a customer's details.
7. Global search over all records.
8. A customer's whole history on one page.
9. Sign-in to the agency's own instance (a URL field on the login screen).

**In the web CRM** (from the CRM page, Pricing and the case study; "50+ modules"):
1. Dashboards and reports, with customizable widgets and agent performance.
2. Contacts and leads, and converting a lead into a contact.
3. Opportunities: a client's request, with **automatic matching** to
   properties, and sending those properties by email.
4. Properties with custom fields, images, video and documents, synced to the
   agency website.
5. Documents, in folders, uploaded or linked.
6. A calendar filled automatically: contract expiry, follow-ups, meetings,
   visits.
7. Activity reminders, in the CRM, by email and by push.
8. Transactions (a property moved to sold), commissions calculated
   automatically, and payments, including partial ones.
9. Import and export (Excel/CSV) of leads, contacts, opportunities and
   properties.
10. Comments on every record, and internal chat between agents.
11. Automated workflows.
12. Agent and office targets, and KPI dashboards.
13. "RIA", an AI assistant.
14. Property contracts, visit forms, PDF and email templates, a property
    brochure, a newsletter and email marketing.
15. Integrations: Gmail, Google Calendar, Mailchimp, Facebook, and local
    listing portals.
16. Agencies with offices and teams: a 4-user minimum, records assigned to
    agents, collaboration between agents and offices.

**Plans** (per user per month, billed yearly): Starter €14, Professional €19,
Enterprise €29. Workflows, the AI assistant, transactions and commissions,
targets and API access start at Professional.

## Side by side

**Have**: Shtëpia.ime already does it. **Part**: some of it. **Missing**: not
yet. **Phase** is when we build it (below).

| BSP feature | Shtëpia.ime today | Status | Phase |
| --- | --- | --- | --- |
| Share a property to social media and WhatsApp | Share button on the listing (the phone's share sheet: Instagram, WhatsApp, Facebook…) and a WhatsApp button | Have | — |
| Properties: photos, video, details | Listing wizard: photos, video link, features, 8 languages | Have | — |
| Website synchronized with the CRM | One backend for app and website | Have | — |
| Push notifications | New messages and viewings (`push_outbox`) | Part | 2 (reminders) |
| Dashboard | Agent dashboard: listings, views, chats, lead count, viewing requests, buyer requests | Part | 1 (agenda) |
| Today's events / calendar | Viewings, as a list | Part | 1 (today's agenda), 2 (calendar with tasks) |
| Leads and contacts | `leads` table with a status; only a count on the dashboard, no screen | Part | **1 (lead manager)** |
| Opportunities with auto-matching | Buyer requests (`wanted_homes`) shown to agents, but not matched | Part | **1 (match against your listings)**, 2 (match a lead's needs) |
| Send matching properties to the client | Share one listing at a time | Part | 2 (send all matches on WhatsApp) |
| Quick add a record | "+" adds a listing | Part | 2 (quick add: lead, task, viewing) |
| Global search | Searches listings; leads can't be searched | Part | 1 (search leads) |
| Customer's history on one page | Chats and viewings, on separate screens | Missing | 2 (lead page) |
| Tasks and reminders | — | Missing | 2 |
| Reports, KPI dashboards | Per-listing analytics | Part | 3 |
| Transactions, commissions, payments | Mark sold or rented | Part | 3 |
| Documents | — | Missing | 3 |
| Import / export | — | Missing | 2 (export leads to CSV), 3 (import) |
| Property brochure (PDF) | — | Missing | 3 (needs a PDF library: ask first) |
| Contracts, visit forms, templates | — | Missing | 3 |
| Comments, internal chat between agents | Chat is client ↔ agent only | Missing | 4 (needs agencies) |
| Teams, offices, assigning records | One role "agent"; agency-admin is planned | Missing | 4 (open business question) |
| Targets, KPIs per agent or office | — | Missing | 4 (needs agencies) |
| Automated workflows | — | Missing | 4 |
| AI assistant for agents | AI listing assistant for buyers | Part | 4 |
| Email marketing, newsletter | Saved-search alert emails | Part | 4 |
| Integrations (Google Calendar, Gmail, portals) | — | Missing | 2 (calendar file), 4 (the rest) |
| Agency's own instance and URL | One shared marketplace | — | Not wanted: it is the opposite of a marketplace |

## The phases

**Phase 1: built now (2026-10-27), with no database change.**
- **Lead manager** (`/leads` in the app):
  - every lead with search and a status filter;
  - add, edit, change status, delete;
  - call, WhatsApp or email in one tap;
  - the dashboard's lead count opens it.
- **Today's agenda** on the agent dashboard: today's viewings, requested and
  confirmed, in time order.
- **Auto-matching for buyer requests**: each open request on the dashboard
  shows how many of your active listings fit it (city, sale or rent, budget,
  bedrooms), and lists them.

**Phase 2: written, needs your approval** (database migrations in
`supabase/pending/crm_phase2_tasks_and_lead_needs.sql`, not applied):
- **Tasks and reminders**: a title, a due time, done or not, and an optional
  link to a lead, listing or viewing. A push reminder before the due time.
  Shows in the agenda.
- **What a lead is looking for**: city, sale or rent, budget, bedrooms. The
  lead manager then matches a lead to your listings, like phase 1 does for
  buyer requests.
- After those two:
  - a lead's page with their whole history (chats, viewings, tasks);
  - quick add for lead, task and viewing;
  - sending all matches on WhatsApp in one message;
  - exporting leads to CSV;
  - an `.ics` calendar file for Google or Apple Calendar.

**Phase 3**:
- transactions and commissions when a listing is marked sold or rented;
- private documents per listing or lead;
- simple reports;
- a PDF brochure, which needs a PDF library, so ask first.

**Phase 4, after a decision on agencies** (CLAUDE.md lists the agency-admin
role as an open question):
- teams and offices;
- assigning leads and listings to agents;
- comments and internal chat;
- targets and KPIs;
- workflows;
- an AI assistant for agents;
- email marketing.

## What not to copy

- **Their branding, texts and screens.** We take the features, in our own design
  (DECISIONS.md W1: the Expo app is the design source of truth).
- **The per-agency instance and login URL.** Shtëpia.ime is one marketplace.
- **Per-user monthly pricing** for the basics. Our monetization is decided
  (DECISIONS.md M1): listing promotion and agency plans. CRM extras such as
  workflows, reports and teams are a natural part of the **agency plan**.
