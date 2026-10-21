// supabase/functions/push-dispatch/index.ts
//
// Sends queued message/viewing pushes (docs/LAUNCH_TASKS.md F14). The queue,
// push_outbox, is filled by database triggers on messages and viewings
// (migration 20261021051557), only for people who have a device registered
// and have not turned that kind off.
//
// OFF until the owner sets PUSH_DISPATCH_ENABLED=true. Real delivery also
// needs production builds with push credentials (APNs for iOS, FCM for
// Android, configured in EAS); Expo Go on Android cannot receive remote
// pushes. EXPO_ACCESS_TOKEN is optional (Expo's "enhanced security").
//
// Auth: scheduler only (service-role key or PUSH_CRON_SECRET header).
// Logs carry outbox ids only: no names, tokens or message content.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildPush, chunk, dispatchEnabled, readTickets, stillWanted } from './logic.js';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('PUSH_CRON_SECRET');
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const MAX_PER_RUN = 200;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isScheduler(req: Request): boolean {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (sameSecret(bearer, SERVICE_ROLE_KEY)) return true;
  return Boolean(CRON_SECRET) && sameSecret(req.headers.get('x-cron-secret') ?? '', CRON_SECRET!);
}

type Outbox = { id: number; user_id: string; kind: string; data: Record<string, string>; attempts: number };

async function dispatch() {
  const { data: rows, error } = await admin
    .from('push_outbox')
    .select('id, user_id, kind, data, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) throw new Error(error.message);
  const queued = (rows ?? []) as Outbox[];
  if (!queued.length) return { sent: 0, failed: 0, removedTokens: 0, optedOut: 0 };

  // Switched off since it was queued: never sent, kept with the reason.
  const { data: prefRows, error: prefError } = await admin
    .from('notification_preferences')
    .select('user_id, messages, viewings')
    .in('user_id', [...new Set(queued.map((i) => i.user_id))]);
  if (prefError) throw new Error(prefError.message);
  const prefsByUser = new Map((prefRows ?? []).map((p) => [p.user_id, p]));
  const items = queued.filter((i) => stillWanted(i.kind, prefsByUser.get(i.user_id)));
  const optedOut = queued.filter((i) => !items.includes(i)).map((i) => i.id);
  if (optedOut.length) {
    await admin.from('push_outbox').update({ status: 'failed', last_error: 'opted_out' }).in('id', optedOut);
  }
  if (!items.length) return { sent: 0, failed: 0, removedTokens: 0, optedOut: optedOut.length };

  const userIds = [...new Set(items.map((i) => i.user_id))];
  const senderIds = [...new Set(items.map((i) => i.data?.sender_id).filter(Boolean))];
  const [{ data: tokens }, { data: profiles }] = await Promise.all([
    admin.from('push_tokens').select('token, user_id').in('user_id', userIds),
    admin.from('profiles').select('id, full_name, preferred_language').in('id', [...userIds, ...senderIds]),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // One Expo message per (queued push, device).
  const messages: { to: string; title: string; body: string; data: { url: string }; sound: 'default' }[] = [];
  const owners: number[] = [];
  for (const item of items) {
    const lang = profileById.get(item.user_id)?.preferred_language ?? 'sq';
    const senderName = item.data?.sender_id ? profileById.get(item.data.sender_id)?.full_name : null;
    const push = buildPush({ kind: item.kind, data: item.data, lang, senderName });
    for (const t of (tokens ?? []).filter((t) => t.user_id === item.user_id)) {
      messages.push({ to: t.token, title: push.title, body: push.body, data: { url: push.url }, sound: 'default' });
      owners.push(item.id);
    }
  }

  const okIds = new Set<number>();
  const dead: string[] = [];
  let offset = 0;
  for (const batch of chunk(messages)) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (res?.ok) {
      const { data: tickets } = await res.json();
      const { deadTokens } = readTickets(tickets, batch.map((m) => m.to));
      dead.push(...deadTokens);
      (tickets ?? []).forEach((t: { status?: string }, i: number) => {
        if (t?.status === 'ok') okIds.add(owners[offset + i]);
      });
    }
    offset += batch.length;
  }

  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);

  let sent = 0;
  let failed = 0;
  for (const item of items) {
    if (okIds.has(item.id)) {
      await admin.from('push_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: item.attempts + 1 }).eq('id', item.id);
      sent++;
    } else {
      const attempts = item.attempts + 1;
      await admin
        .from('push_outbox')
        .update({ attempts, status: attempts >= 5 ? 'failed' : 'pending', last_error: 'not_delivered' })
        .eq('id', item.id);
      failed++;
    }
  }
  return { sent, failed, removedTokens: dead.length, optedOut: optedOut.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isScheduler(req)) return json({ error: 'unauthorized' }, 401);
  if (!dispatchEnabled(Deno.env.toObject())) {
    const { count } = await admin.from('push_outbox').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    return json({ dispatch: 'off', pending: count ?? 0 });
  }
  try {
    return json({ dispatch: 'on', ...(await dispatch()) });
  } catch (err) {
    console.error('push-dispatch error', (err as Error).message);
    return json({ error: 'failed' }, 500);
  }
});
