import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

interface ProfileStats {
  loading: boolean;
  saved: number;
  searches: number;
  third: number;
}

/**
 * Mirrors web's useProfileStats.js — three counts for the profile stats
 * strip: saved favorites, saved searches, and a role-dependent third count
 * (active listings for agents, upcoming viewings for clients). RN's
 * auth-context doesn't fetch the `profiles` row (see auth-context.tsx), so
 * role comes from user_metadata, same as the rest of profile.tsx.
 */
export function useProfileStats(): ProfileStats {
  const { user } = useAuth();
  const isAgent = user?.user_metadata?.role === 'agent';
  const [stats, setStats] = useState<ProfileStats>({
    loading: true,
    saved: 0,
    searches: 0,
    third: 0,
  });

  useEffect(() => {
    if (!user) {
      setStats({ loading: false, saved: 0, searches: 0, third: 0 });
      return;
    }

    let active = true;

    Promise.all([
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('saved_searches').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      isAgent
        ? supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user.id)
            .eq('status', 'active')
        : supabase
            .from('viewings')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', user.id)
            .in('status', ['requested', 'confirmed']),
    ])
      .then(([f, s, t]) => {
        if (!active) return;
        setStats({
          loading: false,
          saved: f.count ?? 0,
          searches: s.count ?? 0,
          third: t.count ?? 0,
        });
      })
      .catch(() => {
        if (!active) return;
        setStats({ loading: false, saved: 0, searches: 0, third: 0 });
      });

    return () => {
      active = false;
    };
  }, [user, isAgent]);

  return stats;
}
