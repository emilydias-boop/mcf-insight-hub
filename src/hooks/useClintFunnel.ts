import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FunnelStageData {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
  stage_id: string;
}

export const useClintFunnel = (originId: string, weekStart?: Date, weekEnd?: Date) => {
  return useQuery({
    queryKey: ['clint-funnel', originId, weekStart?.toISOString(), weekEnd?.toISOString()],
    queryFn: async () => {
      // Buscar stages da origem
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stages')
        .select('*')
        .eq('origin_id', originId)
        .eq('is_active', true)
        .order('stage_order', { ascending: true });

      if (stagesError) throw stagesError;
      if (!stages || stages.length === 0) return [];

      // Buscar deals por stage
      let dealsQuery = supabase
        .from('crm_deals')
        .select('stage_id, created_at')
        .eq('origin_id', originId);

      if (weekStart) {
        dealsQuery = dealsQuery.gte('created_at', weekStart.toISOString());
      }
      if (weekEnd) {
        dealsQuery = dealsQuery.lte('created_at', weekEnd.toISOString());
      }

      const { data: deals, error: dealsError } = await dealsQuery;

      if (dealsError) throw dealsError;

      // Buscar metas da semana
      let targetsQuery = supabase
        .from('team_targets')
        .select('*')
        .eq('target_type', 'funnel_stage')
        .eq('origin_id', originId);

      if (weekStart) {
        targetsQuery = targetsQuery.eq('week_start', weekStart.toISOString().split('T')[0]);
      }

      const { data: targets } = await targetsQuery;

      console.log('[useClintFunnel] Loaded targets:', targets);
      console.log('[useClintFunnel] Week start filter:', weekStart?.toISOString().split('T')[0]);

      // Contar deals por stage
      const dealsByStage: Record<string, number> = {};
      deals?.forEach(deal => {
        if (deal.stage_id) {
          dealsByStage[deal.stage_id] = (dealsByStage[deal.stage_id] || 0) + 1;
        }
      });

      console.log('[useClintFunnel] Deals by stage:', dealsByStage);

      // Montar dados do funil
      const funnelData: FunnelStageData[] = [];
      let previousCount = 0;

      stages.forEach((stage, index) => {
        const currentCount = dealsByStage[stage.id] || 0;
        const target = targets?.find(t => t.reference_id === stage.id);
        
        console.log(`[useClintFunnel] Stage "${stage.stage_name}":`, {
          id: stage.id,
          currentLeads: currentCount,
          targetValue: target?.target_value || 0,
          targetFound: !!target,
          targetReferenceId: target?.reference_id
        });
        
        // Taxa de conversão: (atual / anterior) * 100, ou 100 para primeira etapa
        const conversionRate = index === 0 
          ? 100 
          : previousCount > 0 
            ? (currentCount / previousCount) * 100 
            : 0;

        funnelData.push({
          etapa: stage.stage_name,
          leads: currentCount,
          conversao: conversionRate,
          meta: target?.target_value || 0,
          stage_id: stage.id,
        });

        previousCount = currentCount;
      });

      console.log('[useClintFunnel] Final funnel data:', funnelData);

      return funnelData;
    },
    enabled: !!originId,
  });
};
