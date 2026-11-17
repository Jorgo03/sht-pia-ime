// supabase/functions/saved-search-alerts/index.ts
//
// Saved-search alerts (docs/LAUNCH_TASKS.md F13). Run on a schedule; it does
// two things:
//
//   1. QUEUE. For every saved search with alerts on, find active
//      listings created since the last run that match its filters (the same
//      rules as the apps, logic.js). Each (search, listing) pair is recorded in
//      saved_search_alert_deliveries first; its primary key means a listing is
//      never alerted twice for the same search, however often this runs. One
//      notification per search goes to the notification centre and push
//      (alerts_enabled), one email to email_outbox (email_alerts).
//   2. SEND, only when the owner has switched it on: ALERTS_DISPATCH_ENABLED=
//      'true' plus RESEND_API_KEY and ALERT_EMAIL_FROM secrets. Until then the
//      queue just fills and nothing leaves the server.
//
// Auth: scheduler only. The caller must present the service-role key or the
// database's vault secret in x-cron-secret. App users get 401, so this is
// deployed without JWT verification, as push-dispatch is.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { alertNotificationData, applySavedFilters, buildAlertEmail, dedupeKey, dispatchEnabled, notTheirOwn, unsubscribeHeaders, windowStart } from './logic.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://real-estate-app-hazel-seven.vercel.app').replace(/\/+$/, '');
const MAX_SEARCHES_PER_RUN = 500;
const MAX_NEW_PER_SEARCH = 50;
const MAX_SENDS_PER_RUN = 50;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Constant-time comparison, so a wrong secret leaks nothing through timing. */
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isScheduler(req: Request): Promise<boolean> {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (sameSecret(bearer, SERVICE_ROLE_KEY)) return true;
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!secret) return false;
  const { data, error } = await admin.rpc('push_dispatch_secret_ok', { p_secret: secret });
  return !error && data === true;
}

type Search = {
  id: string;
  user_id: string;
  name: string | null;
  filters: Record<string, unknown> | null;
  created_at: string;
  last_alerted_at: string | null;
  unsubscribe_token: string;
  alerts_enabled: boolean | null;
  email_alerts: boolean;
};

async function queue(now: string): Promise<{ searches: number; queued: number; failed: number }> {
  const { data: searches, error } = await admin
    .from('saved_searches')
    .select('id, user_id, name, filters, created_at, last_alerted_at, unsubscribe_token, alerts_enabled, email_alerts')
    .or('alerts_enabled.eq.true,email_alerts.eq.true')
    .order('last_alerted_at', { ascending: true, nullsFirst: true })
    .limit(MAX_SEARCHES_PER_RUN);
  if (error) throw new Error(`saved_searches: ${error.message}`);

  let queued = 0;
  let failed = 0;
  for (const s of (searches ?? []) as Search[]) {
    try {
      const { data: rows, error: qErr } = await applySavedFilters(
        admin
          .from('properties')
          .select('id, title, title_i18n, city, price, currency, created_at, owner_id, agent_id')
          .eq('status', 'active')
          // A listing a moderator has hidden must not be announced.
          .not('moderation_hold', 'is', true)
          .gt('created_at', windowStart(s))
          .lte('created_at', now)
          .order('created_at', { ascending: false })
          .limit(MAX_NEW_PER_SEARCH),
        s.filters,
      );
      if (qErr) throw new Error(qErr.message);

      const matches = notTheirOwn(rows ?? [], s.user_id);
      if (matches.length) {
        // Only pairs inserted now are new; existing pairs come back empty.
        const { data: fresh, error: dErr } = await admin
          .from('saved_search_alert_deliveries')
          .upsert(matches.map((r) => ({ saved_search_id: s.id, property_id: r.id })), {
            onConflict: 'saved_search_id,property_id',
            ignoreDuplicates: true,
          })
          .select('property_id');
        if (dErr) throw new Error(dErr.message);
        const freshIds = new Set((fresh ?? []).map((f) => f.property_id));
        const listings = matches.filter((r) => freshIds.has(r.id));

        if (listings.length && s.alerts_enabled) {
          const { error: pushErr } = await admin.rpc('queue_push', {
            p_user: s.user_id,
            p_kind: 'saved_search',
            p_data: alertNotificationData(s.id, listings),
            p_key: dedupeKey(s.id, listings.map((l) => l.id)),
          });
          if (pushErr) throw new Error(pushErr.message);
          queued++;
        }

        if (listings.length && s.email_alerts) {
          const { data: profile } = await admin
            .from('profiles')
            .select('preferred_language')
            .eq('id', s.user_id)
            .maybeSingle();
          const mail = buildAlertEmail({
            lang: profile?.preferred_language ?? 'sq',
            searchName: s.name ?? '',
            listings,
            siteUrl: SITE_URL,
            unsubscribeUrl: `${SUPABASE_URL}/functions/v1/saved-search-unsubscribe?token=${s.unsubscribe_token}`,
          });
          const { error: oErr } = await admin.from('email_outbox').insert({
            kind: 'saved_search_alert',
            user_id: s.user_id,
            subject: mail.subject.slice(0, 200),
            body_text: mail.text,
            body_html: mail.html,
            dedupe_key: dedupeKey(s.id, listings.map((l) => l.id)),
          });
          // 23505 = this exact email is already queued (a retried run).
          if (oErr && oErr.code !== '23505') throw new Error(oErr.message);
        }
      }

      await admin.from('saved_searches').update({ last_alerted_at: now }).eq('id', s.id);
    } catch (err) {
      failed++;
      // Search id only: no filters, names or emails in the logs.
      console.error('saved-search-alerts: search failed', s.id, (err as Error).message);
    }
  }
  return { searches: searches?.length ?? 0, queued, failed };
}

async function send(): Promise<{ sent: number; failed: number }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')!;
  const from = Deno.env.get('ALERT_EMAIL_FROM')!;
  const { data: pending } = await admin
    .from('email_outbox')
    .select('id, user_id, subject, body_text, body_html, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(MAX_SENDS_PER_RUN);

  let sent = 0;
  let failed = 0;
  for (const m of pending ?? []) {
    const { data: user } = await admin.auth.admin.getUserById(m.user_id);
    const to = user?.user?.email;
    if (!to) {
      await admin.from('email_outbox').update({ status: 'failed', last_error: 'no_email' }).eq('id', m.id);
      failed++;
      continue;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: m.subject,
        text: m.body_text,
        html: m.body_html,
        headers: unsubscribeHeaders(m.body_text, SUPABASE_URL),
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as Response);
    if (res.ok) {
      await admin.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: m.attempts + 1 }).eq('id', m.id);
      sent++;
    } else {
      const attempts = m.attempts + 1;
      await admin
        .from('email_outbox')
        .update({ attempts, status: attempts >= 5 ? 'failed' : 'pending', last_error: `http_${res.status}` })
        .eq('id', m.id);
      failed++;
    }
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await isScheduler(req))) return json({ error: 'unauthorized' }, 401);
  try {
    const result = await queue(new Date().toISOString());
    const env = Deno.env.toObject();
    const dispatch = dispatchEnabled(env) ? await send() : { sent: 0, failed: 0 };
    return json({ ...result, dispatch: dispatchEnabled(env) ? 'on' : 'off', ...dispatch });
  } catch (err) {
    console.error('saved-search-alerts error', (err as Error).message);
    return json({ error: 'failed' }, 500);
  }
});
