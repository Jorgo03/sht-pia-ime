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
// GET only shows a page with a button; the button and RFC 8058 one-click from
// mail clients POST, and only a POST turns alerts off. A GET used to do it
// too, so corporate link scanners and link previews unsubscribed people who
// never clicked.

import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const page = (body: string) => `<!doctype html>
<html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Shtëpia.ime</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1a1714;background:#f7f3ec}button{font:inherit;padding:.6rem 1.2rem;border-radius:999px;border:0;background:#c2410c;color:#fff;cursor:pointer}</style></head>
<body><h1>Shtëpia.ime</h1>
${body}
</body></html>`;

// The token is a validated UUID, so it is safe inside the attribute.
const CONFIRM = (token: string) => page(`<p>Të mos marrësh më email për këtë kërkim të ruajtur?</p>
<p lang="en">Stop emails for this saved search?</p>
<form method="post" action="?token=${token}"><button type="submit">Ç'regjistrohu · Unsubscribe</button></form>`);

const DONE = page(`<p>Nuk do të marrësh më email për këtë kërkim të ruajtur.</p>
<p lang="en">You will no longer get emails for this saved search.</p>`);

const html = (body: string) =>
  new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!UUID.test(token)) return new Response('bad_request', { status: 400 });
  if (req.method === 'GET') return html(CONFIRM(token));

  const { error } = await admin.from('saved_searches').update({ email_alerts: false }).eq('unsubscribe_token', token);
  if (error) {
    console.error('saved-search-unsubscribe failed', error.code);
    return new Response('try_again_later', { status: 503 });
  }
  return html(DONE);
});
