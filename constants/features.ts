// Product switches for whole features.
//
// AI chat is parked (owner decision 2026-11-04, DECISIONS.md C2): the Home
// "Pyet asistentin AI" entry, the Search ✦ button, the /assistant screen and the
// chat on each listing page are hidden, and /assistant sends people home. The
// code, Edge Functions and tests are kept; set this to true to bring them back
// (and un-skip the AI chat tests, which read the same switch).
export const AI_CHAT_ENABLED = false;
