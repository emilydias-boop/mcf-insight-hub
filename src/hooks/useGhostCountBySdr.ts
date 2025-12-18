import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GhostCountBySdr {
  sdr_email: string;
  pending_count: number;
  critical_count: number;
  high_count: number;
}

export function useGhostCountBySdr() {
  return useQuery({
    queryKey: ['ghost-count-by-sdr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ghost_appointments_audit')
        .select('sdr_email, severity, status')
        .eq('status', 'pending');

      if (error) throw error;

      // Aggregate by SDR
      const bySdr: Record<string, GhostCountBySdr> = {};

      (data || []).forEach((item) => {
        if (!bySdr[item.sdr_email]) {
          bySdr[item.sdr_email] = {
            sdr_email: item.sdr_email,
            pending_count: 0,
            critical_count: 0,
            high_count: 0,
          };
        }
        bySdr[item.sdr_email].pending_count++;
        if (item.severity === 'critical') bySdr[item.sdr_email].critical_count++;
        if (item.severity === 'high') bySdr[item.sdr_email].high_count++;
      });

      return bySdr;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
