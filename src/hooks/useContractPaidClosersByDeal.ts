import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * For a list of deal IDs, returns a Map<dealId, closerName> indicating
 * the closer of the R1 (or any) meeting where the contract was marked
 * as paid (`contract_paid_at IS NOT NULL`). Used to evaluate R2 special
 * markings whose rule depends on the closer who closed the deal — even
 * when the saved R1 closer of the R2 meeting is someone else.
 */
export function useContractPaidClosersByDeal(dealIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(dealIds.filter(Boolean) as string[])).sort();
  const key = ids.join(',');

  return useQuery({
    queryKey: ['contract-paid-closers-by-deal', key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          deal_id,
          contract_paid_at,
          meeting_slots!inner(
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey(name)
          )
        `)
        .in('deal_id', ids)
        .not('contract_paid_at', 'is', null);

      if (error) throw error;

      // Pick the most recent contract_paid_at per deal.
      const byDeal = new Map<string, { paidAt: string; name: string }>();
      (data || []).forEach((row: any) => {
        const dealId = row.deal_id as string | null;
        const paidAt = row.contract_paid_at as string | null;
        const name = row.meeting_slots?.closer?.name as string | null;
        if (!dealId || !paidAt || !name) return;
        const prev = byDeal.get(dealId);
        if (!prev || paidAt > prev.paidAt) {
          byDeal.set(dealId, { paidAt, name });
        }
      });

      const out = new Map<string, string>();
      byDeal.forEach((v, k) => out.set(k, v.name));
      return out;
    },
  });
}