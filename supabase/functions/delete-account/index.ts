// supabase/functions/delete-account/index.ts
//
// Permanent account deletion, required for store approval:
//   Apple App Store Review Guideline 5.1.1(v) — an app that supports account
//   creation must let the user initiate deletion from inside the app.
//   Google Play (2024 data-deletion policy) — same, plus a web-reachable route.
//
// Auth: the caller's own access token ONLY. The uid is taken from the verified
// token, never from the request body, so this endpoint cannot be pointed at
// another user's account no matter what is POSTed.
//
// Why this needs the service role at all: deleting a row in auth.users is an
// admin operation. Everything else below could be done with the user's own
// token under RLS, but doing it here keeps the whole teardown atomic-ish and
// in one auditable place.
//
// Deletion order matters, and most of it is NOT covered by the FK cascade:
//
//   profiles.id -> auth.users ON DELETE CASCADE
//     ...so deleting the auth user already removes: profiles, conversations,
//     favorites, leads, messages, saved_searches, viewings(client_id),
//     wanted_homes, and properties where the user is the AGENT.
//
//   properties.owner_id -> auth.users ON DELETE SET NULL   <-- the problem
//     A client who listed their own home has owner_id set and agent_id null.
//     On a bare auth-user delete that listing SURVIVES with owner_id = NULL:
//     still status='active' so still publicly visible, still carrying their
//     photos and contact_phone, and now un-editable and un-deletable by
//     anyone — the RLS policies require owner_id or agent_id to match a uid,
//     and both are null. That is a privacy failure dressed as a dangling row,
//     so owned properties are deleted explicitly first.
//
//   storage objects do not cascade at all
//     avatars/<uid>/... and property-images/<uid>/... would outlive the
//     account and stay reachable, since both buckets are public-read. Removed
//     explicitly.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BUCKETS = ['avatars', 'property-images'];

/** Remove everything under `<uid>/` in a public bucket. Best-effort: a storage
 *  failure must not abort the account deletion itself, or the user is left in
 *  the "permanently inaccessible account" state the stores also reject. */
async function purgeBucket(bucket: string, uid: string): Promise<number> {
  const { data, error } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
  if (error || !data?.length) return 0;
  const paths = data.map((f) => `${uid}/${f.name}`);
  const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
  return rmErr ? 0 : paths.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // Identity comes from the verified token, never the body.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return json({ error: 'unauthorized' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const uid = user.id;

    // 1. Storage first. If this fails we still proceed — an orphaned image is
    //    a smaller problem than an account the user cannot delete.
    let filesRemoved = 0;
    for (const b of BUCKETS) filesRemoved += await purgeBucket(b, uid);

    // 2. Properties they OWN. Not covered by cascade (SET NULL), and the
    //    reason this function exists rather than a bare admin.deleteUser call.
    const { error: propErr, count: propsDeleted } = await admin
      .from('properties')
      .delete({ count: 'exact' })
      .eq('owner_id', uid);
    if (propErr) return json({ error: 'delete_failed', stage: 'properties' }, 500);

    // 3. The auth user. Cascades profiles -> conversations, favorites, leads,
    //    messages, saved_searches, viewings, wanted_homes, agent listings.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) return json({ error: 'delete_failed', stage: 'auth_user' }, 500);

    return json({ ok: true, filesRemoved, propertiesDeleted: propsDeleted ?? 0 });
  } catch {
    // Never leak internals to the client (§19).
    return json({ error: 'delete_failed' }, 500);
  }
});
