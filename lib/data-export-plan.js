// What "Download my data" collects: every table that holds the signed-in
// person's own rows, the column that ties a row to them, and the columns
// left out because they are secrets rather than personal data. Pure data so
// tests/dataExport.test.mjs can check it; lib/data-export.ts runs it. Reads
// go through RLS as the person themself, like every other screen.

export const EXPORT_TABLES = [
  { table: 'profiles', match: ['id'] },
  { table: 'properties', match: ['owner_id', 'agent_id'] },
  { table: 'favorites', match: ['user_id'] },
  { table: 'saved_searches', match: ['user_id'], omit: ['unsubscribe_token'] },
  { table: 'wanted_homes', match: ['client_id'] },
  { table: 'viewings', match: ['client_id', 'agent_id'] },
  { table: 'conversations', match: ['client_id', 'agent_id'] },
  { table: 'leads', match: ['agent_id'] },
  { table: 'notifications', match: ['user_id'] },
  { table: 'notification_preferences', match: ['user_id'] },
  { table: 'content_reports', match: ['reporter_id'] },
  { table: 'user_blocks', match: ['blocker_id'] },
];

/** Rows per request, and the most kept per table. */
export const PAGE = 500;
export const MAX_ROWS = 5000;

/** PostgREST `or` filter for a row belonging to `userId`. */
export const ownerFilter = (match, userId) => match.map((c) => `${c}.eq.${userId}`).join(',');

/** Removes secret columns from rows. */
export const stripColumns = (rows, omit = []) =>
  omit.length ? rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !omit.includes(k)))) : rows;
// The file people get is an Excel report built from these rows: lib/data-report.js.
