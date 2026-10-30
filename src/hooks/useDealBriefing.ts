import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDealBriefing(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ['deal-briefing', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_briefing_ia').select('*').eq('deal_id', dealId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | null | undefined)?.status;
      return s === 'pendente' || s === 'gerando' ? 10_000 : false;
    },
  });
}

/** Resumo/alerta em lote para os participantes visíveis da Agenda (uma query só). */
export function useBriefingsResumo(dealIds: string[]) {
  const ids = [...new Set(dealIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['deal-briefing-resumo', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, { resumo: string; alerta: string }>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase
          .from('deal_briefing_ia')
          .select('deal_id, resumo:conteudo->>resumo_curto, alerta:conteudo->>alerta_curto')
          .in('deal_id', ids.slice(i, i + 100));
        if (error) throw error;
        for (const r of (data ?? []) as Array<{ deal_id: string; resumo: string | null; alerta: string | null }>) {
          if (r.resumo || r.alerta) map.set(r.deal_id, { resumo: r.resumo ?? '', alerta: r.alerta ?? '' });
        }
      }
      return map;
    },
  });
}
