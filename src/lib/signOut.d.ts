// Types for signOut.js, so the phone app (TypeScript) can import it.
import type { SupabaseClient } from '@supabase/supabase-js';

export function signOutOfDevice(client: SupabaseClient): Promise<{ error: Error | null }>;
