import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FunnelStageData {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
  stage_id?: string;
}

export const useClintFunnelByLeadType = (
  originId: string,
  leadType: 'A' | 'B',
  weekStart?: Date,
  weekEnd?: Date,
  showCurrentState = false
) => {
  return useQuery({
    queryKey: ['clint-funnel-by-lead-type', originId, leadType, weekStart?.toISOString(), weekEnd?.toISOString(), showCurrentState],
    queryFn: async () => {
      if (!originId) return [];

      // Buscar stages ativas para a origem
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stages')
        .select('*')
        .eq('origin_id', originId)
        .eq('is_active', true)
        .order('stage_order', { ascending: true });

      if (stagesError) throw stagesError;
      if (!stages || stages.length === 0) return [];

      // Definir lógica de filtro por tipo de lead
      const filterByLeadType = (tags: string[] | null) => {
        if (!tags || tags.length === 0) return false;
        
        if (leadType === 'A') {
          // Lead A: tag contém "A010" OU é exatamente "lead a"
          return tags.some(tag => 
            tag.toUpperCase().includes('A010') || 
            tag.toLowerCase() === 'lead a'
          );
        } else {
          // Lead B: tag contém "INSTAGRAM" OU é exatamente "lead b"
          return tags.some(tag => 
            tag.toUpperCase().includes('INSTAGRAM') || 
            tag.toLowerCase() === 'lead b'
          );
        }
      };

      let dealsByStage: Record<string, number> = {};

      if (showCurrentState) {
        // Estado atual: buscar deals no stage_id atual
        const { data: deals, error: dealsError } = await supabase
          .from('crm_deals')
          .select('id, stage_id, tags')
          .eq('origin_id', originId);

        if (dealsError) throw dealsError;

        // Filtrar por tipo de lead e contar por stage
        deals?.forEach(deal => {
          if (filterByLeadType(deal.tags) && deal.stage_id) {
            dealsByStage[deal.stage_id] = (dealsByStage[deal.stage_id] || 0) + 1;
          }
        });

      } else if (weekStart && weekEnd) {
        // Período histórico: usar deal_activities
        const startStr = weekStart.toISOString();
        const endStr = weekEnd.toISOString();

        // Buscar atividades de stage_change no período
        const { data: activities, error: activitiesError } = await supabase
          .from('deal_activities')
          .select('deal_id, to_stage, created_at, metadata')
          .eq('activity_type', 'stage_change')
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (activitiesError) throw activitiesError;

        // Buscar tags dos deals
        const dealIds = [...new Set(activities?.map(a => a.deal_id) || [])];
        const { data: deals, error: dealsError } = await supabase
          .from('crm_deals')
          .select('id, tags, origin_id')
          .in('id', dealIds)
          .eq('origin_id', originId);

        if (dealsError) throw dealsError;

        // Criar mapa de deal_id -> tags
        const dealTagsMap: Record<string, string[] | null> = {};
        deals?.forEach(deal => {
          dealTagsMap[deal.id] = deal.tags;
        });

        // Contar atividades por stage, filtrando por tipo de lead
        activities?.forEach(activity => {
          const tags = dealTagsMap[activity.deal_id];
          if (filterByLeadType(tags) && activity.to_stage) {
            dealsByStage[activity.to_stage] = (dealsByStage[activity.to_stage] || 0) + 1;
          }
        });
      }

      // Buscar metas para os stages no período
      const targetsMap: Record<string, number> = {};
      if (weekStart && weekEnd) {
        const { data: targets } = await supabase
          .from('team_targets')
          .select('reference_id, target_value')
          .eq('origin_id', originId)
          .eq('target_type', 'funnel_stage')
          .gte('week_start', weekStart.toISOString().split('T')[0])
          .lte('week_end', weekEnd.toISOString().split('T')[0]);

        targets?.forEach(target => {
          if (target.reference_id) {
            targetsMap[target.reference_id] = target.target_value;
          }
        });
      }

      // Montar dados do funil
      const funnelData: FunnelStageData[] = stages.map((stage, index) => {
        const leads = dealsByStage[stage.id] || 0;
        const meta = targetsMap[stage.id] || 0;
        const conversao = index > 0 && stages[index - 1] 
          ? (dealsByStage[stages[index - 1].id] || 0) > 0
            ? (leads / (dealsByStage[stages[index - 1].id] || 1)) * 100
            : 0
          : 100;

        return {
          etapa: stage.stage_name,
          leads,
          conversao,
          meta,
          stage_id: stage.id,
        };
      });

      return funnelData;
    },
    enabled: !!originId,
  });
};
