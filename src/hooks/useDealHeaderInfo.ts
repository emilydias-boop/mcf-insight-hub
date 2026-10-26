import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Mesmo mapa de cor do card do kanban (DealKanbanCard). */
export const CANAL_DOT_CLASSES: Record<string, string> = {
  blue: 'bg-blue-400', teal: 'bg-teal-400', orange: 'bg-orange-400', cyan: 'bg-cyan-400',
  purple: 'bg-purple-400', green: 'bg-green-400', indigo: 'bg-indigo-400', pink: 'bg-pink-400',
  amber: 'bg-amber-400', slate: 'bg-slate-400', zinc: 'bg-zinc-400', gray: 'bg-gray-400',
};

export interface DealHeaderInfo {
  canalRotulo: string | null;
  canalCor: string | null;
  ownerName: string | null;
  closerR1Name: string | null;
  resumo: { lastTouchAt?: string | null; lastContactAttempt?: string | null; totalActivities?: number } | null;
}

/** Leitura somente: canal de entrada, dono, closer R1 e resumo de toques do negócio. */
export function useDealHeaderInfo(deal: any) {
  return useQuery({
    queryKey: ['deal-header-info', deal?.id, deal?.owner_profile_id, deal?.r1_closer_email, deal?.updated_at],
    enabled: !!deal?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<DealHeaderInfo> => {
      const [canalRes, resumoRes, ownerRes, closerRes] = await Promise.all([
        supabase.rpc('kanban_canal_entrada', {
          p_custom: deal.custom_fields ?? {},
          p_tags: deal.tags ?? [],
          p_data_source: deal.data_source ?? null,
        } as any),
        supabase.rpc('kanban_resumo_lote', { p_ids: [deal.id] }),
        deal.owner_profile_id
          ? supabase.from('profiles').select('full_name').eq('id', deal.owner_profile_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        deal.r1_closer_email
          ? supabase.from('closers').select('name').ilike('email', deal.r1_closer_email).limit(1).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      let canalRotulo: string | null = null;
      let canalCor: string | null = null;
      const codigo = (canalRes as any)?.data as string | null;
      if (codigo) {
        const { data } = await supabase
          .from('crm_canais_entrada')
          .select('rotulo, cor')
          .eq('codigo', codigo)
          .maybeSingle();
        canalRotulo = data?.rotulo ?? codigo;
        canalCor = data?.cor ?? null;
      }

      const linha = ((resumoRes as any)?.data ?? [])[0];
      return {
        canalRotulo,
        canalCor,
        ownerName: (ownerRes as any)?.data?.full_name ?? null,
        closerR1Name: (closerRes as any)?.data?.name ?? null,
        resumo: linha?.resumo ?? null,
      };
    },
  });
}
