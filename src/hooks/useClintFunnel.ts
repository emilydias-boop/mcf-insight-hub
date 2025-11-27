import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateForDB } from '@/lib/dateHelpers';

interface FunnelStageData {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
  stage_id: string;
}

export const useClintFunnel = (originId: string, weekStart?: Date, weekEnd?: Date, showCurrentState = false) => {
  return useQuery({
    queryKey: ['clint-funnel', originId, weekStart?.toISOString(), weekEnd?.toISOString(), showCurrentState],
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

      let dealsByStage: Record<string, number> = {};

      if (showCurrentState) {
        // Visão Atual: mostrar todos os deals na stage atual, sem filtro de data
        console.log('[useClintFunnel] Using current state view (all deals)');
        
        const { data: deals, error: dealsError } = await supabase
          .from('crm_deals')
          .select('stage_id, created_at')
          .eq('origin_id', originId);

        if (dealsError) throw dealsError;

        // Contar deals por stage
        deals?.forEach(deal => {
          if (deal.stage_id) {
            dealsByStage[deal.stage_id] = (dealsByStage[deal.stage_id] || 0) + 1;
          }
        });
      } else {
        // Modo de período: filtrar por data
        const isPastPeriod = weekStart && weekStart < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (isPastPeriod && weekStart && weekEnd) {
          // Para períodos passados, usar deal_activities para histórico
          console.log('[useClintFunnel] Using deal_activities for past period');
          
          const { data: activities, error: activitiesError } = await supabase
            .from('deal_activities')
            .select('to_stage, created_at, deal_id')
            .eq('activity_type', 'stage_change')
            .gte('created_at', weekStart.toISOString())
            .lte('created_at', weekEnd.toISOString());

          if (activitiesError) {
            console.error('[useClintFunnel] Error fetching activities:', activitiesError);
          } else {
            // Contar apenas última atividade de cada deal no período
            const dealLatestStage: Record<string, { stage: string; date: Date }> = {};
            
            activities?.forEach(act => {
              if (act.to_stage && act.deal_id) {
                const actDate = new Date(act.created_at);
                const current = dealLatestStage[act.deal_id];
                
                if (!current || actDate > current.date) {
                  dealLatestStage[act.deal_id] = {
                    stage: act.to_stage,
                    date: actDate,
                  };
                }
              }
            });

            // Contar por stage
            Object.values(dealLatestStage).forEach(({ stage }) => {
              dealsByStage[stage] = (dealsByStage[stage] || 0) + 1;
            });
          }
        } else {
          // Para período atual, usar crm_deals
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

          // Contar deals por stage
          deals?.forEach(deal => {
            if (deal.stage_id) {
              dealsByStage[deal.stage_id] = (dealsByStage[deal.stage_id] || 0) + 1;
            }
          });
        }
      }

      // Buscar metas da semana
      let targetsQuery = supabase
        .from('team_targets')
        .select('*')
        .eq('target_type', 'funnel_stage')
        .eq('origin_id', originId);

      if (weekStart && weekEnd) {
        const startDate = formatDateForDB(weekStart);
        const endDate = formatDateForDB(weekEnd);
        targetsQuery = targetsQuery
          .lte('week_start', endDate)   // week_start <= fim do período
          .gte('week_end', startDate);  // week_end >= início do período
      }

      const { data: targets } = await targetsQuery;

      console.log('[useClintFunnel] Loaded targets:', targets);
      console.log('[useClintFunnel] Week start filter:', weekStart?.toISOString().split('T')[0]);
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
