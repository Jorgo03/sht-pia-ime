# Website: page redesign report

2026-11-17. What changed on each page for desktop, and why. Mobile layouts
were kept; each change is gated on desktop width (≥1024px,
`useIsDesktopWeb`) so phones look as before. Results per page:
`WEBSITE_COMPLETE_AUDIT.md`.

| Page | Before | After | Files |
|---|---|---|---|
| Messages `/messages` | Phone list stretched in a 720px column | Two panes: conversation list (380px) and a "choose a conversation" pane | `app/(tabs)/messages.tsx`, new string `messages.selectConversation` (10 languages) |
| Chat `/messages/<id>` | Chat alone in a column; back to switch | List beside the chat; the open conversation is highlighted; switching replaces the address | `app/messages/[id].tsx` |
| Agencies `/agents` | One column of wide rows | 3-column grid | `app/agents/index.tsx` |
| Agent dashboard | 720px phone column | Up to 1080px, stat cards 4 across | `app/agent-dashboard/index.tsx` |
| Listing `/property/<id>` | Gallery 288px tall | 420–640px (two thirds of the window) | `app/property/[id].tsx` |
| Legal pages, guide | Footer squeezed inside the text column | Text column, then a full-width footer | `components/legal/legal-document.tsx` |
| Home | Hero photo lazy, could paint late | Loaded eagerly with high priority | `components/web/website-home.tsx` |
| Private pages (favourites, saved searches, viewings, my listings, listing statistics) | Visitor saw an empty or zero screen | Visitor is asked to sign in | those route files |

The website frame (`constants/web-frame.ts`) now treats `/agent-dashboard`
and `/messages` as full-width website pages instead of 720px app screens.

Already in place before this audit (W5, W9): site header and footer,
landing Home, Explore with a filter sidebar and 3-column results, wanted
board, guide.
