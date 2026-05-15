import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricoCall {
  id: string;
  user_id: string;
  to_number: string | null;
  from_number: string | null;
  direction: string | null;
  status: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  notes: string | null;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  follow_up_action: string | null;
  follow_up_at: string | null;
  summary: string | null;
  deal_id: string | null;
  contact_id: string | null;
  deal_name: string | null;
  deal_email: string | null;
  deal_phone: string | null;
  user_full_name: string | null;
}

export interface CallsFilter {
  userId: string | null; // SDR target (null = self resolved at call site)
  days: number; // 7 / 30 / 90
  followUp: 'all' | 'retornar' | 'whatsapp' | 'sem_interesse' | 'agendado' | 'pendente';
  search: string;
}

export function useMeuHistoricoCalls(filter: CallsFilter) {
  return useQuery({
    queryKey: ['meu-historico-calls', filter],
    enabled: !!filter.userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - filter.days);

      let query = supabase
        .from('calls')
        .select(
          'id,user_id,to_number,from_number,direction,status,duration_seconds,outcome,notes,recording_url,started_at,ended_at,created_at,follow_up_action,follow_up_at,summary,deal_id,contact_id'
        )
        .eq('user_id', filter.userId!)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (filter.followUp !== 'all') {
        if (filter.followUp === 'pendente') {
          query = query.in('follow_up_action', ['retornar', 'whatsapp']);
        } else {
          query = query.eq('follow_up_action', filter.followUp);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as any[];
      const dealIds = Array.from(new Set(rows.map((r) => r.deal_id).filter(Boolean)));
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

      const [dealsRes, profilesRes] = await Promise.all([
        dealIds.length
          ? supabase.from('crm_deals').select('id,nome_completo,email,telefone').in('id', dealIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from('profiles').select('id,full_name').in('id', userIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const dealsMap = new Map<string, any>((dealsRes.data || []).map((d: any) => [d.id, d]));
      const profilesMap = new Map<string, any>(
        (profilesRes.data || []).map((p: any) => [p.id, p])
      );

      const enriched: HistoricoCall[] = rows.map((r) => {
        const deal = r.deal_id ? dealsMap.get(r.deal_id) : null;
        const profile = r.user_id ? profilesMap.get(r.user_id) : null;
        return {
          ...r,
          deal_name: deal?.nome_completo ?? null,
          deal_email: deal?.email ?? null,
          deal_phone: deal?.telefone ?? null,
          user_full_name: profile?.full_name ?? null,
        };
      });

      const search = filter.search.trim().toLowerCase();
      if (!search) return enriched;
      return enriched.filter((c) => {
        const haystack = `${c.deal_name ?? ''} ${c.deal_email ?? ''} ${c.deal_phone ?? ''} ${c.to_number ?? ''} ${c.from_number ?? ''}`.toLowerCase();
        return haystack.includes(search);
      });
    },
  });
}