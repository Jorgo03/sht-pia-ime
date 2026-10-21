// supabase/functions/saved-search-unsubscribe/index.ts
//
// One-click unsubscribe from a saved-search email (docs/LAUNCH_TASKS.md F13).
// The link in every alert carries the search's secret unsubscribe_token; the
// link needs no sign-in, because people unsubscribe from their mail app.
//
// It only ever turns email_alerts OFF for the one search the token belongs
// to. It cannot turn anything on, read anything, or reveal whether a token
// exists: every well-formed request gets the same page.
//
// verify_jwt is false for this function (an email link has no session).
// GET shows the page; POST supports RFC 8058 one-click from mail clients.

import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE = `<!doctype html>
<html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Shtëpia.ime</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1a1714;background:#f7f3ec}</style></head>
<body><h1>Shtëpia.ime</h1>
<p>Nuk do të marrësh më email për këtë kërkim të ruajtur.</p>
<p lang="en">You will no longer get emails for this saved search.</p>
</body></html>`;

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!UUID.test(token)) return new Response('bad_request', { status: 400 });

  const { error } = await admin.from('saved_searches').update({ email_alerts: false }).eq('unsubscribe_token', token);
  if (error) {
    console.error('saved-search-unsubscribe failed', error.code);
    return new Response('try_again_later', { status: 503 });
  }
  return new Response(PAGE, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
});
