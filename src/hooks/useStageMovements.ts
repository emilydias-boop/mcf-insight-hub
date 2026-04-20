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
  toStageNameKey: string;
  toStageName: string;
  toStageOrder: number;
  fromStageName: string | null;
  when: string | null; // null = snapshot only (parado, sem movimentação no período)
  tags: string[];
  isSnapshotOnly?: boolean;
}

export interface StageMovementsSummaryRow {
  stageId: string;
  stageNameKey: string;
  stageName: string;
  stageOrder: number;
  uniqueLeads: number;   // acumulado: passou ∪ está lá
  passagens: number;     // movimentações no período
  parados: number;       // snapshot atual no estágio
}

export interface UseStageMovementsParams {
  originIds: string[] | null;
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

const normalizeStageName = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
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
      // 1) Atividades stage_change no período
      const { data: activities, error: actErr } = await supabase
        .from('deal_activities')
        .select('id, deal_id, from_stage, to_stage, created_at')
        .eq('activity_type', 'stage_change')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);

      if (actErr) throw actErr;

      if (activities && activities.length === 10000) {
        console.warn(
          '[useStageMovements] Limite de 10.000 atingido — encurte o período ou filtre por pipeline.',
        );
      }

      const acts = activities || [];

      // 2) Stages (resolver nome/ordem)
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, clint_id, stage_name, stage_order')
        .eq('is_active', true);

      const stageByKey = new Map<string, { id: string; name: string; order: number }>();
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

      // 3) Snapshot atual: deals filtrados por origem
      let snapshotQ = supabase
        .from('crm_deals')
        .select('id, name, tags, origin_id, stage_id')
        .not('stage_id', 'is', null)
        .limit(10000);
      if (originIds && originIds.length > 0) {
        snapshotQ = snapshotQ.in('origin_id', originIds);
      }
      const { data: snapshotDealsRaw, error: snapErr } = await snapshotQ;
      if (snapErr) throw snapErr;
      const snapshotDeals = snapshotDealsRaw || [];

      // 4) Deals envolvidos em movimentações (para nome/tags/origin)
      const movementDealIds = [
        ...new Set(acts.map((a) => a.deal_id).filter((id) => id && isValidUUID(id))),
      ];

      const dealChunks = chunk(movementDealIds, 200);
      const dealsResults = await Promise.all(
        dealChunks.map(async (ids) => {
          let q = supabase
            .from('crm_deals')
            .select('id, name, tags, origin_id, stage_id')
            .in('id', ids);
          if (originIds && originIds.length > 0) {
            q = q.in('origin_id', originIds);
          }
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        }),
      );
      const movementDeals = dealsResults.flat();

      // Merge: união de deals (snapshot + envolvidos em movimentações)
      const allDealsMap = new Map<string, typeof snapshotDeals[number]>();
      [...movementDeals, ...snapshotDeals].forEach((d) => {
        if (d?.id) allDealsMap.set(d.id, d);
      });

      // Filtro de tags (mesma regra para ambas fontes)
      const passesTagFilter = (deal: { tags: unknown }) => {
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
      };

      const filteredDealsMap = new Map<string, typeof snapshotDeals[number]>();
      allDealsMap.forEach((d, id) => {
        if (passesTagFilter(d)) filteredDealsMap.set(id, d);
      });

      if (filteredDealsMap.size === 0) return { summary: [], rows: [] };

      // 5) Origens
      const originIdsFromDeals = [
        ...new Set(
          Array.from(filteredDealsMap.values())
            .map((d) => d.origin_id)
            .filter((id): id is string => !!id),
        ),
      ];
      const originChunks = originIdsFromDeals.length > 0 ? chunk(originIdsFromDeals, 200) : [];
      const originsResults = await Promise.all(
        originChunks.map(async (ids) => {
          const { data, error } = await supabase
            .from('crm_origins')
            .select('id, name')
            .in('id', ids);
          if (error) throw error;
          return data || [];
        }),
      );
      const originMap = new Map(originsResults.flat().map((o) => [o.id, o.name]));

      // 6) Agregação por nome normalizado
      type AggEntry = {
        stageId: string;
        stageName: string;
        stageOrder: number;
        uniqueLeads: Set<string>;
        passagens: number;
        parados: number;
      };
      const summaryMap = new Map<string, AggEntry>();

      const ensureEntry = (key: string, stage: { id: string; name: string; order: number }) => {
        let e = summaryMap.get(key);
        if (!e) {
          e = {
            stageId: stage.id,
            stageName: stage.name,
            stageOrder: stage.order,
            uniqueLeads: new Set<string>(),
            passagens: 0,
            parados: 0,
          };
          summaryMap.set(key, e);
        } else if (stage.order < e.stageOrder) {
          e.stageOrder = stage.order;
          e.stageName = stage.name;
          e.stageId = stage.id;
        }
        return e;
      };

      // 7) Linhas de movimentação
      const rows: StageMovementRow[] = [];

      acts.forEach((act) => {
        const deal = filteredDealsMap.get(act.deal_id);
        if (!deal) return;
        const stage = resolveStage(act.to_stage);
        if (!stage) return;
        const fromStage = resolveStage(act.from_stage);
        const key = normalizeStageName(stage.name) || stage.id;

        rows.push({
          activityId: act.id,
          dealId: deal.id,
          dealName: deal.name || '(sem nome)',
          originId: deal.origin_id,
          originName: deal.origin_id ? originMap.get(deal.origin_id) || null : null,
          toStageId: stage.id,
          toStageNameKey: key,
          toStageName: stage.name,
          toStageOrder: stage.order,
          fromStageName: fromStage?.name ?? null,
          when: act.created_at!,
          tags: Array.isArray(deal.tags) ? (deal.tags as string[]) : [],
        });

        const e = ensureEntry(key, stage);
        if (!e.uniqueLeads.has(deal.id)) {
          e.uniqueLeads.add(deal.id);
        }
        e.passagens += 1;
      });

      // 8) Snapshot: somar quem está parado em cada estágio
      // Conjunto de (dealId+stageKey) já contado como movimento pra evitar duplicar "passagens" (não precisamos)
      // mas para "parados" contamos sempre 1 por deal/estágio atual.
      const movedSetByStage = new Map<string, Set<string>>(); // stageKey -> Set<dealId>
      rows.forEach((r) => {
        if (!movedSetByStage.has(r.toStageNameKey)) movedSetByStage.set(r.toStageNameKey, new Set());
        movedSetByStage.get(r.toStageNameKey)!.add(r.dealId);
      });

      filteredDealsMap.forEach((deal) => {
        if (!deal.stage_id) return;
        const stage = resolveStage(deal.stage_id);
        if (!stage) return;
        const key = normalizeStageName(stage.name) || stage.id;
        const e = ensureEntry(key, stage);
        e.parados += 1;
        const wasAlreadyCounted = e.uniqueLeads.has(deal.id);
        e.uniqueLeads.add(deal.id);

        // Se este deal não teve movimentação para este estágio no período, adicionar linha "snapshot only"
        const movedHere = movedSetByStage.get(key)?.has(deal.id);
        if (!movedHere) {
          rows.push({
            activityId: `snap-${deal.id}-${stage.id}`,
            dealId: deal.id,
            dealName: deal.name || '(sem nome)',
            originId: deal.origin_id,
            originName: deal.origin_id ? originMap.get(deal.origin_id) || null : null,
            toStageId: stage.id,
            toStageNameKey: key,
            toStageName: stage.name,
            toStageOrder: stage.order,
            fromStageName: null,
            when: null,
            tags: Array.isArray(deal.tags) ? (deal.tags as string[]) : [],
            isSnapshotOnly: true,
          });
        }
        void wasAlreadyCounted;
      });

      const summary: StageMovementsSummaryRow[] = Array.from(summaryMap.entries())
        .map(([key, v]) => ({
          stageId: v.stageId,
          stageNameKey: key,
          stageName: v.stageName,
          stageOrder: v.stageOrder,
          uniqueLeads: v.uniqueLeads.size,
          passagens: v.passagens,
          parados: v.parados,
        }))
        .sort((a, b) => a.stageOrder - b.stageOrder || a.stageName.localeCompare(b.stageName));

      console.info('[useStageMovements]', {
        activities: acts.length,
        snapshotDeals: snapshotDeals.length,
        dealsAfterFilter: filteredDealsMap.size,
        rows: rows.length,
        stages: summary.length,
      });

      return { summary, rows };
    },
  });
}
