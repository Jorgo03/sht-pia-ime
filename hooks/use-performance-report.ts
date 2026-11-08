import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { MonthPoint, PeriodRange } from '@/src/lib/performanceReport';

/** What my_performance_report() returns (docs/PERFORMANCE_REPORT.md). Counts only. */
export interface PerformanceReport {
  since: string;
  time_zone: string;
  listings: { published: number; published_total: number; active_now: number; paused_now: number };
  deals: { sales: number; rentals: number; sales_total: number; rentals_total: number };
  viewings: { scheduled: number; completed: number; cancelled: number; completed_total: number };
  contact: { inquiries: number; inquiries_total: number; messages_sent: number; clients_answered: number };
  leads: { added: number; won: number };
  monthly: MonthPoint[];
  baseline: Baseline | null;
}

export interface Baseline {
  monthly_rentals: number | null;
  monthly_sales: number | null;
  monthly_inquiries: number | null;
  monthly_viewings: number | null;
  updated_at?: string;
}

/** The device's own IANA zone, so months are the agent's months. The
 *  database checks the name and falls back to Europe/Tirane. */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Tirane';
  } catch {
    return 'Europe/Tirane';
  }
}

export const performanceKeys = {
  report: (userId: string, from: string | null, to: string | null) => ['performance', userId, from, to] as const,
};

/**
 * The signed-in agent's own report for `[from, to)`. The function takes no
 * agent id: the database answers for whoever is signed in, and refuses
 * anyone who is not an agent.
 */
export function usePerformanceReport(userId: string | undefined, range: PeriodRange | null) {
  const from = range?.from ? range.from.toISOString() : null;
  const to = range?.to ? range.to.toISOString() : null;
  return useQuery({
    queryKey: performanceKeys.report(userId ?? '', from, to),
    enabled: !!userId && !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_performance_report', {
        p_from: from,
        p_to: to,
        p_tz: deviceTimeZone(),
      });
      if (error) throw error;
      return data as PerformanceReport;
    },
  });
}

/** Saves (or replaces) the agent's own before-Shtëpia.ime estimate. */
export function useSaveBaseline(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Omit<Baseline, 'updated_at'>) => {
      if (!userId) throw new Error('signed out');
      const { error } = await supabase
        .from('agent_performance_baselines')
        .upsert({ agent_id: userId, ...values }, { onConflict: 'agent_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performance'] }),
  });
}
