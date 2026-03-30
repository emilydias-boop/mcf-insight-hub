import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateForDB } from '@/lib/dateHelpers';
import { classifyChannel } from '@/lib/channelClassifier';

interface FunnelStageData {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
  stage_id: string;
}

export const useClintFunnel = (originId: string, weekStart?: Date, weekEnd?: Date, showCurrentState = false, channelFilter = '') => {
  return useQuery({
    queryKey: ['clint-funnel', originId, weekStart?.toISOString(), weekEnd?.toISOString(), showCurrentState, channelFilter],
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

      // Helper to classify and filter deals
      const filterAndCountDeals = (deals: any[]) => {
        const counts: Record<string, number> = {};
        deals?.forEach(deal => {
          if (!deal.stage_id) return;

          // Apply channel filter if set
          if (channelFilter) {
            const tags: string[] = ((deal as any).tags || []).map((t: any) => typeof t === 'string' ? t : t?.name || '');
            const originName = (deal as any).origin?.name || null;
            const leadChannel = (deal as any).custom_fields?.lead_channel || null;
            const dataSource = (deal as any).data_source || null;

            const channel = classifyChannel({
              tags,
              originName,
              leadChannel,
              dataSource,
              hasA010: false,
            });

            if (channel !== channelFilter) return;
          }

          counts[deal.stage_id] = (counts[deal.stage_id] || 0) + 1;
        });
        return counts;
      };

      if (showCurrentState) {
        const { data: deals, error: dealsError } = await supabase
          .from('crm_deals')
          .select('stage_id, created_at, tags, custom_fields, data_source, origin:crm_origins(name)')
          .eq('origin_id', originId);

        if (dealsError) throw dealsError;
        dealsByStage = filterAndCountDeals(deals || []);
      } else {
        const isPastPeriod = weekStart && weekStart < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (isPastPeriod && weekStart && weekEnd) {
          // For past periods, use deal_activities
          const { data: activities, error: activitiesError } = await supabase
            .from('deal_activities')
            .select('to_stage, created_at, deal_id')
            .eq('activity_type', 'stage_change')
            .gte('created_at', weekStart.toISOString())
            .lte('created_at', weekEnd.toISOString());

          if (activitiesError) {
            console.error('[useClintFunnel] Error fetching activities:', activitiesError);
          } else {
            const dealLatestStage: Record<string, { stage: string; date: Date }> = {};
            activities?.forEach(act => {
              if (act.to_stage && act.deal_id) {
                const actDate = new Date(act.created_at);
                const current = dealLatestStage[act.deal_id];
                if (!current || actDate > current.date) {
                  dealLatestStage[act.deal_id] = { stage: act.to_stage, date: actDate };
                }
              }
            });

            if (channelFilter) {
              // Need to fetch deal metadata for channel classification
              const dealIds = Object.keys(dealLatestStage);
              if (dealIds.length > 0) {
                // Fetch in batches of 50
                const batchSize = 50;
                const dealMeta: Record<string, any> = {};
                for (let i = 0; i < dealIds.length; i += batchSize) {
                  const batch = dealIds.slice(i, i + batchSize);
                  const { data: batchDeals } = await supabase
                    .from('crm_deals')
                    .select('id, tags, custom_fields, data_source, origin:crm_origins(name)')
                    .in('id', batch);
                  batchDeals?.forEach(d => { dealMeta[d.id] = d; });
                }

                Object.entries(dealLatestStage).forEach(([dealId, { stage }]) => {
                  const deal = dealMeta[dealId];
                  if (!deal) return;
                  const tags: string[] = ((deal as any).tags || []).map((t: any) => typeof t === 'string' ? t : t?.name || '');
                  const ch = classifyChannel({
                    tags,
                    originName: (deal as any).origin?.name || null,
                    leadChannel: (deal as any).custom_fields?.lead_channel || null,
                    dataSource: (deal as any).data_source || null,
                    hasA010: false,
                  });
                  if (ch === channelFilter) {
                    dealsByStage[stage] = (dealsByStage[stage] || 0) + 1;
                  }
                });
              }
            } else {
              Object.values(dealLatestStage).forEach(({ stage }) => {
                dealsByStage[stage] = (dealsByStage[stage] || 0) + 1;
              });
            }
          }
        } else {
          let dealsQuery = supabase
            .from('crm_deals')
            .select('stage_id, created_at, tags, custom_fields, data_source, origin:crm_origins(name)')
            .eq('origin_id', originId);

          if (weekStart) dealsQuery = dealsQuery.gte('created_at', weekStart.toISOString());
          if (weekEnd) dealsQuery = dealsQuery.lte('created_at', weekEnd.toISOString());

          const { data: deals, error: dealsError } = await dealsQuery;
          if (dealsError) throw dealsError;
          dealsByStage = filterAndCountDeals(deals || []);
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
          .lte('week_start', endDate)
          .gte('week_end', startDate);
      }

      const { data: targets } = await targetsQuery;

      // Montar dados do funil
      const funnelData: FunnelStageData[] = [];
      let previousCount = 0;

      stages.forEach((stage, index) => {
        const currentCount = dealsByStage[stage.id] || 0;
        const target = targets?.find(t => t.reference_id === stage.id);
        
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

      return funnelData;
    },
    enabled: !!originId,
  });
};
