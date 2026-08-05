import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface R2VendasKPIs {
  vendasRealizadas: number;
}

export const useR2VendasKPIs = (startDate: Date, endDate: Date, segment?: string) => {
  const seg = segment && segment !== 'all' ? segment.toUpperCase() : null;
  return useQuery({
    queryKey: ['r2-vendas-kpis', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), seg],
    queryFn: async (): Promise<R2VendasKPIs> => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch deal_activities for Vendas stage only
      // R2 Agendadas/Realizadas now come from meeting_slots (useR2MeetingSlotsKPIs)
      const { data, error } = await supabase
        .from('deal_activities')
        .select('to_stage, created_at, deal_id')
        .eq('to_stage', 'Venda realizada')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);

      if (error) {
        console.error('Error fetching Vendas KPIs:', error);
        throw error;
      }

      let rows = data || [];

      // Filtro opcional por segmento ICP (via deal_id → crm_deals.icp_segment)
      if (seg) {
        const ids = Array.from(new Set(rows.map((r: any) => r.deal_id).filter(Boolean)));
        const allowed = new Set<string>();
        const CHUNK = 200;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const { data: deals, error: dealsError } = await (supabase.from('crm_deals') as any)
            .select('id, icp_segment')
            .in('id', chunk);
          if (dealsError) throw dealsError;
          (deals || []).forEach((d: any) => {
            const v = (d.icp_segment ?? '').toString().trim().toUpperCase();
            if (v === seg) allowed.add(d.id);
          });
        }
        rows = rows.filter((r: any) => r.deal_id && allowed.has(r.deal_id));
      }

      const vendasRealizadas = rows.length;

      return {
        vendasRealizadas,
      };
    },
    staleTime: 30 * 1000,
  });
};
