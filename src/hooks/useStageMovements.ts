import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TagFilterRule, TagOperator } from '@/components/crm/TagFilterPopover';

export interface StageMovementRow {
  activityId: string;
  dealId: string;
  dealName: string;
  originId: string | null;
  originName: string | null;
  toStageId: string | null;
  toStageName: string;
  toStageOrder: number;
  fromStageName: string | null;
  when: string;
  tags: string[];
}

export interface StageMovementsSummaryRow {
  stageId: string;
  stageName: string;
  stageOrder: number;
  uniqueLeads: number;
  totalPassages: number;
}

export interface UseStageMovementsParams {
  originIds: string[] | null; // null = all (no filter)
  startDate: Date;
  endDate: Date;
  tagFilters: TagFilterRule[];
  tagOperator: TagOperator;
  enabled?: boolean;
}

const normalizeTag = (t: unknown): string => {
  if (typeof t !== 'string') return '';
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .trim()
    .toLowerCase();
};

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const chunk = <T,>(arr: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export function useStageMovements({
  originIds,
  startDate,
  endDate,
  tagFilters,
  tagOperator,
  enabled = true,
}: UseStageMovementsParams) {
  return useQuery({
    queryKey: [
      'stage-movements',
      originIds,
      startDate.toISOString(),
      endDate.toISOString(),
      tagFilters,
      tagOperator,
    ],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{
      summary: StageMovementsSummaryRow[];
      rows: StageMovementRow[];
    }> => {
      // 1) Buscar atividades de stage_change no período
      const { data: activities, error: actErr } = await supabase
        .from('deal_activities')
        .select('id, deal_id, from_stage, to_stage, created_at')
        .eq('activity_type', 'stage_change')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (actErr) throw actErr;
      if (!activities || activities.length === 0) {
        return { summary: [], rows: [] };
      }

      // 2) Buscar todos os deals envolvidos
      const dealIds = [...new Set(activities.map((a) => a.deal_id).filter((id) => id && isValidUUID(id)))];
      if (dealIds.length === 0) return { summary: [], rows: [] };

      // Paginar IN(...) em chunks de 200 para evitar HTTP 400 por URL longa
      const dealChunks = chunk(dealIds, 200);
      const dealsResults = await Promise.all(
        dealChunks.map(async (ids) => {
          let q = supabase
            .from('crm_deals')
            .select('id, name, tags, origin_id')
            .in('id', ids);
          if (originIds && originIds.length > 0) {
            q = q.in('origin_id', originIds);
          }
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        })
      );
      const deals = dealsResults.flat();

      // Filtrar tags
      const filteredDeals = (deals || []).filter((deal) => {
        if (tagFilters.length === 0) return true;
        const dealTags = Array.isArray(deal.tags) ? (deal.tags as unknown[]) : [];
        const normalized = dealTags.map(normalizeTag).filter(Boolean);
        const evaluate = (rule: TagFilterRule) => {
          const has = normalized.includes(normalizeTag(rule.tag));
          return rule.mode === 'has' ? has : !has;
        };
        return tagOperator === 'and'
          ? tagFilters.every(evaluate)
          : tagFilters.some(evaluate);
      });

      const dealMap = new Map(filteredDeals.map((d) => [d.id, d]));
      if (dealMap.size === 0) return { summary: [], rows: [] };

      // 3) Buscar nomes de origens
      const originIdsFromDeals = [
        ...new Set(filteredDeals.map((d) => d.origin_id).filter((id): id is string => !!id)),
      ];
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id, name')
        .in('id', originIdsFromDeals.length > 0 ? originIdsFromDeals : ['00000000-0000-0000-0000-000000000000']);
      const originMap = new Map((origins || []).map((o) => [o.id, o.name]));

      // 4) Buscar todas as stages para resolver nomes/ordem
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, clint_id, stage_name, stage_order')
        .eq('is_active', true);

      // Indexa stages por id, stage_id e stage_name (lower)
      const stageByKey = new Map<
        string,
        { id: string; name: string; order: number }
      >();
      (stages || []).forEach((s) => {
        const entry = { id: s.id, name: s.stage_name, order: s.stage_order ?? 999 };
        if (s.id) stageByKey.set(s.id, entry);
        if (s.clint_id) stageByKey.set(s.clint_id, entry);
        if (s.stage_name) stageByKey.set(s.stage_name.toLowerCase(), entry);
      });

      const resolveStage = (raw: string | null) => {
        if (!raw) return null;
        return (
          stageByKey.get(raw) ||
          stageByKey.get(raw.toLowerCase()) ||
          { id: raw, name: raw, order: 999 }
        );
      };

      // 5) Construir rows
      const rows: StageMovementRow[] = [];
      const summaryMap = new Map<
        string,
        { stageName: string; stageOrder: number; uniqueLeads: Set<string>; totalPassages: number }
      >();

      activities.forEach((act) => {
        const deal = dealMap.get(act.deal_id);
        if (!deal) return;
        const stage = resolveStage(act.to_stage);
        if (!stage) return;
        const fromStage = resolveStage(act.from_stage);

        rows.push({
          activityId: act.id,
          dealId: deal.id,
          dealName: deal.name || '(sem nome)',
          originId: deal.origin_id,
          originName: deal.origin_id ? originMap.get(deal.origin_id) || null : null,
          toStageId: stage.id,
          toStageName: stage.name,
          toStageOrder: stage.order,
          fromStageName: fromStage?.name ?? null,
          when: act.created_at!,
          tags: Array.isArray(deal.tags) ? (deal.tags as string[]) : [],
        });

        const existing = summaryMap.get(stage.id);
        if (existing) {
          existing.uniqueLeads.add(deal.id);
          existing.totalPassages += 1;
        } else {
          summaryMap.set(stage.id, {
            stageName: stage.name,
            stageOrder: stage.order,
            uniqueLeads: new Set([deal.id]),
            totalPassages: 1,
          });
        }
      });

      const summary: StageMovementsSummaryRow[] = Array.from(summaryMap.entries())
        .map(([stageId, v]) => ({
          stageId,
          stageName: v.stageName,
          stageOrder: v.stageOrder,
          uniqueLeads: v.uniqueLeads.size,
          totalPassages: v.totalPassages,
        }))
        .sort((a, b) => a.stageOrder - b.stageOrder || a.stageName.localeCompare(b.stageName));

      return { summary, rows };
    },
  });
}