import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface LeadTransferEntry {
  id: string;
  deal_id: string;
  created_at: string;
  description: string | null;
  user_id: string | null;
  bulk_transfer: boolean;
  previous_owner: string | null;
  new_owner: string | null;
  new_owner_name: string | null;
  transferred_by: string | null;
  // enriched
  deal_name: string | null;
  deal_email: string | null;
  deal_phone: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

export function useLeadTransfersAudit(days: number = 7, search: string = '') {
  return useQuery({
    queryKey: ['lead-transfers-audit', days, search],
    queryFn: async (): Promise<LeadTransferEntry[]> => {
      const since = subDays(new Date(), days).toISOString();
      const { data, error } = await supabase
        .from('deal_activities')
        .select('id, deal_id, description, user_id, metadata, created_at')
        .eq('activity_type', 'owner_change')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      const rows = (data || []) as any[];

      const dealIds = Array.from(new Set(rows.map(r => r.deal_id).filter(Boolean)));
      const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));

      const [dealsRes, profilesRes] = await Promise.all([
        dealIds.length
          ? supabase
              .from('crm_deals')
              .select('id, name, email, phone')
              .in('id', dealIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const dealMap = new Map((dealsRes.data || []).map((d: any) => [d.id, d]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

      const entries: LeadTransferEntry[] = rows.map((r) => {
        const meta = (r.metadata || {}) as any;
        const deal = dealMap.get(r.deal_id);
        const actor = r.user_id ? profileMap.get(r.user_id) : null;
        return {
          id: r.id,
          deal_id: r.deal_id,
          created_at: r.created_at,
          description: r.description,
          user_id: r.user_id,
          bulk_transfer: !!meta.bulk_transfer,
          previous_owner: meta.previous_owner ?? null,
          new_owner: meta.new_owner ?? null,
          new_owner_name: meta.new_owner_name ?? null,
          transferred_by: meta.transferred_by ?? null,
          deal_name: deal?.name ?? null,
          deal_email: deal?.email ?? null,
          deal_phone: deal?.phone ?? null,
          actor_name: actor?.full_name ?? null,
          actor_email: actor?.email ?? null,
        };
      });

      if (!search.trim()) return entries;
      const q = search.toLowerCase();
      return entries.filter((e) =>
        [
          e.deal_name,
          e.deal_email,
          e.deal_phone,
          e.previous_owner,
          e.new_owner,
          e.new_owner_name,
          e.transferred_by,
          e.actor_name,
          e.actor_email,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    },
  });
}
