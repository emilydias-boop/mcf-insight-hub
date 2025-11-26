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
      try {
        console.log(`🔍 [FunilByLeadType] Iniciando consulta para Lead ${leadType}`);
        console.log(`🔍 [FunilByLeadType] originId: ${originId}`);
        console.log(`🔍 [FunilByLeadType] showCurrentState: ${showCurrentState}`);
        console.log(`🔍 [FunilByLeadType] weekStart: ${weekStart?.toISOString()}`);
        console.log(`🔍 [FunilByLeadType] weekEnd: ${weekEnd?.toISOString()}`);

        if (!originId) {
          console.warn('⚠️ [FunilByLeadType] originId não fornecido');
          return [];
        }

        // Buscar stages ativas para a origem
        const { data: stages, error: stagesError } = await supabase
          .from('crm_stages')
          .select('*')
          .eq('origin_id', originId)
          .eq('is_active', true)
          .order('stage_order', { ascending: true });

        if (stagesError) {
          console.error('❌ [FunilByLeadType] Erro ao buscar stages:', stagesError);
          throw stagesError;
        }

        console.log(`✅ [FunilByLeadType] Stages encontrados: ${stages?.length || 0}`);
        console.log(`📋 [FunilByLeadType] Stages:`, stages?.map(s => ({ id: s.id, name: s.stage_name })));

        if (!stages || stages.length === 0) {
          console.warn('⚠️ [FunilByLeadType] Nenhum stage encontrado');
          return [];
        }

        // Criar mapa para resolver tanto UUIDs quanto nomes de stages
        const stageIdByNameOrId: Record<string, string> = {};
        stages.forEach(stage => {
          stageIdByNameOrId[stage.id] = stage.id; // UUID -> UUID
          stageIdByNameOrId[stage.stage_name] = stage.id; // Nome -> UUID
          stageIdByNameOrId[stage.stage_name.toLowerCase()] = stage.id; // nome lowercase -> UUID
        });
        
        console.log(`🗺️ [FunilByLeadType] Mapa de stages criado com ${Object.keys(stageIdByNameOrId).length} entradas`);

        // Definir lógica de filtro por tipo de lead
        const filterByLeadType = (tags: string[] | null) => {
          if (!tags || tags.length === 0) return false;
          
          if (leadType === 'A') {
            // Lead A: tag contém "A010" OU é exatamente "lead a"
            const matches = tags.some(tag => 
              tag.toUpperCase().includes('A010') || 
              tag.toLowerCase() === 'lead a'
            );
            return matches;
          } else {
            // Lead B: tag contém "INSTAGRAM" OU é exatamente "lead b"
            const matches = tags.some(tag => 
              tag.toUpperCase().includes('INSTAGRAM') || 
              tag.toLowerCase() === 'lead b'
            );
            return matches;
          }
        };

        let dealsByStage: Record<string, number> = {};

        if (showCurrentState) {
          console.log(`🔄 [FunilByLeadType] Buscando estado atual dos deals...`);
          
          // Estado atual: buscar deals no stage_id atual
          const { data: deals, error: dealsError } = await supabase
            .from('crm_deals')
            .select('id, stage_id, tags')
            .eq('origin_id', originId);

          if (dealsError) {
            console.error('❌ [FunilByLeadType] Erro ao buscar deals:', dealsError);
            throw dealsError;
          }

          console.log(`✅ [FunilByLeadType] Total de deals encontrados: ${deals?.length || 0}`);

          // Filtrar por tipo de lead e contar por stage
          let filteredCount = 0;
          deals?.forEach(deal => {
            const matches = filterByLeadType(deal.tags);
            if (matches && deal.stage_id) {
              // Converter explicitamente para string
              const stageIdStr = String(deal.stage_id);
              dealsByStage[stageIdStr] = (dealsByStage[stageIdStr] || 0) + 1;
              filteredCount++;
            }
          });

          console.log(`✅ [FunilByLeadType] Deals filtrados para Lead ${leadType}: ${filteredCount}`);
          console.log(`📊 [FunilByLeadType] Deals por stage:`, dealsByStage);

        } else if (weekStart && weekEnd) {
          console.log(`🔄 [FunilByLeadType] Buscando dados históricos do período...`);
          
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

          if (activitiesError) {
            console.error('❌ [FunilByLeadType] Erro ao buscar activities:', activitiesError);
            throw activitiesError;
          }

          console.log(`✅ [FunilByLeadType] Activities encontradas: ${activities?.length || 0}`);

          // Buscar tags dos deals
          const dealIds = [...new Set(activities?.map(a => a.deal_id) || [])];
          console.log(`🔄 [FunilByLeadType] Buscando tags para ${dealIds.length} deals únicos...`);

          const { data: deals, error: dealsError } = await supabase
            .from('crm_deals')
            .select('id, tags, origin_id')
            .in('id', dealIds)
            .eq('origin_id', originId);

          if (dealsError) {
            console.error('❌ [FunilByLeadType] Erro ao buscar deals para tags:', dealsError);
            throw dealsError;
          }

          console.log(`✅ [FunilByLeadType] Deals com tags encontrados: ${deals?.length || 0}`);

          // Criar mapa de deal_id -> tags
          const dealTagsMap: Record<string, string[] | null> = {};
          deals?.forEach(deal => {
            dealTagsMap[deal.id] = deal.tags;
          });

          // Contar atividades por stage, filtrando por tipo de lead
          let filteredCount = 0;
          let unmatchedStages: string[] = [];
          
          activities?.forEach(activity => {
            const tags = dealTagsMap[activity.deal_id];
            const matches = filterByLeadType(tags);
            if (matches && activity.to_stage) {
              // Resolver o stage_id a partir do to_stage (pode ser nome ou UUID)
              const resolvedStageId = stageIdByNameOrId[activity.to_stage] || 
                                     stageIdByNameOrId[activity.to_stage?.toLowerCase()];
              
              if (resolvedStageId) {
                dealsByStage[resolvedStageId] = (dealsByStage[resolvedStageId] || 0) + 1;
                filteredCount++;
              } else {
                // Log de stages não mapeados para debug
                unmatchedStages.push(activity.to_stage);
              }
            }
          });

          console.log(`✅ [FunilByLeadType] Activities filtradas para Lead ${leadType}: ${filteredCount}`);
          console.log(`📊 [FunilByLeadType] Deals por stage (histórico):`, dealsByStage);
          
          if (unmatchedStages.length > 0) {
            const uniqueUnmatched = [...new Set(unmatchedStages)];
            console.warn(`⚠️ [FunilByLeadType] Stages não mapeados encontrados (${uniqueUnmatched.length}):`, uniqueUnmatched);
          }
        } else {
          console.warn('⚠️ [FunilByLeadType] Nenhum modo selecionado (nem estado atual, nem período histórico)');
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

          console.log(`🎯 [FunilByLeadType] Metas encontradas: ${targets?.length || 0}`);

          targets?.forEach(target => {
            if (target.reference_id) {
              targetsMap[target.reference_id] = target.target_value;
            }
          });
        }

        // Montar dados do funil
        const funnelData: FunnelStageData[] = stages.map((stage, index) => {
          // Garantir que usamos string para buscar
          const stageIdStr = String(stage.id);
          const leads = dealsByStage[stageIdStr] || 0;
          const meta = targetsMap[stageIdStr] || 0;
          const conversao = index > 0 && stages[index - 1] 
            ? (dealsByStage[String(stages[index - 1].id)] || 0) > 0
              ? (leads / (dealsByStage[String(stages[index - 1].id)] || 1)) * 100
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

        console.log(`✅ [FunilByLeadType] Funil montado com ${funnelData.length} etapas`);
        console.log(`📊 [FunilByLeadType] Dados finais:`, funnelData);

        return funnelData;
      } catch (error) {
        console.error(`❌ [FunilByLeadType] Erro geral no hook:`, error);
        throw error;
      }
    },
    enabled: !!originId,
  });
};
