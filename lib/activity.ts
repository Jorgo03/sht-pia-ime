import { supabase } from '@/lib/supabase';

export type ActivityType = 'call' | 'message' | 'meeting' | 'view' | 'favourite';

const recentViews = new Map<string, number>();

/**
 * Mirrors the web app's src/lib/activity.js exactly — same table, same
 * columns, same 60s view-dedupe so a single detail-screen visit doesn't
 * spam property_activity on re-renders. Feeds Agent Dashboard's stat cards
 * and per-property analytics, so every call site on web must have a match
 * here or mobile visits silently undercount.
 */
export async function logActivity(
  propertyId: string,
  type: ActivityType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (type === 'view') {
    const last = recentViews.get(propertyId);
    if (last && Date.now() - last < 60_000) return;
    recentViews.set(propertyId, Date.now());
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('property_activity').insert({
    property_id: propertyId,
    user_id: user?.id ?? null,
    type,
    metadata,
  });
}
