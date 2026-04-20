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
  const base = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return STAGE_ALIASES[base] ?? base;
};

// Mapa de aliases: agrupa variações de nomes entre pipelines em uma chave canônica
const STAGE_ALIASES: Record<string, string> = {
  'incompleta': 'anamnese incompleta',
  'anamnese incompleta': 'anamnese incompleta',
  'novo lead': 'novo lead',
  'novo lead ( form )': 'novo lead',
  'novo lead (form)': 'novo lead',
  'lead qualificado': 'lead qualificado',
  'reuniao 01 agendada': 'r1 agendada',
  'reuniao 1 agendada': 'r1 agendada',
  'r1 agendada': 'r1 agendada',
  'reuniao 01 realizada': 'r1 realizada',
  'reuniao 1 realizada': 'r1 realizada',
  'r1 realizada': 'r1 realizada',
  'no-show': 'no-show',
  'no show': 'no-show',
  'sem interesse': 'sem interesse',
  'reuniao 02 agendada': 'r2 agendada',
  'reuniao 2 agendada': 'r2 agendada',
  'r2 agendada': 'r2 agendada',
  'reuniao 02 realizada': 'r2 realizada',
  'reuniao 2 realizada': 'r2 realizada',
  'r2 realizada': 'r2 realizada',
  'contrato pago': 'contrato pago',
  'venda realizada': 'venda realizada',
  'proposta enviada': 'proposta enviada',
  'no-show r2': 'no-show r2',
  'no show r2': 'no-show r2',
};

// Ordem fixa de exibição na tabela (por chave canônica)
const STAGE_DISPLAY_ORDER: string[] = [
  'anamnese incompleta',
  'lead gratuito',
  'novo lead',
  'lead instagram',
  'lead qualificado',
  'sem interesse',
  'r1 agendada',
  'no-show',
  'r1 realizada',
  'contrato pago',
  'r2 agendada',
  'no-show r2',
  'r2 realizada',
  'venda realizada',
];

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
      totalUniqueLeads: number;
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

      // 3) UNIVERSO DINÂMICO PELO PERÍODO:
      //    (a) deals envolvidos em movimentações (stage_change) no período
      //    (b) deals criados no período (cobre leads novos sem histórico)
      type DealRow = {
        id: string;
        name: string | null;
        tags: unknown;
        origin_id: string | null;
        stage_id: string | null;
        created_at: string | null;
        contact_id: string | null;
      };

      const movementDealIds = [
        ...new Set(acts.map((a) => a.deal_id).filter((id) => id && isValidUUID(id))),
      ];

      const dealChunks = chunk(movementDealIds, 200);
      const dealsResults = await Promise.all(
        dealChunks.map(async (ids) => {
          let q = supabase
            .from('crm_deals')
            .select('id, name, tags, origin_id, stage_id, created_at, contact_id')
            .in('id', ids)
            .is('archived_at', null);
          if (originIds && originIds.length > 0) {
            q = q.in('origin_id', originIds);
          }
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        }),
      );
      const movementDeals = dealsResults.flat() as DealRow[];

      // (b) Deals criados no período (paginado)
      const createdInPeriod: DealRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        let q = supabase
          .from('crm_deals')
          .select('id, name, tags, origin_id, stage_id, created_at, contact_id')
          .is('archived_at', null)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (originIds && originIds.length > 0) {
          q = q.in('origin_id', originIds);
        }
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as DealRow[];
        createdInPeriod.push(...batch);
        if (batch.length < PAGE) break;
        if (from > 50_000) {
          console.warn('[useStageMovements] Criados no período > 50k, interrompendo.');
          break;
        }
      }

      const allDealsMap = new Map<string, DealRow>();
      [...movementDeals, ...createdInPeriod].forEach((d) => {
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

      const filteredDealsMap = new Map<string, DealRow>();
      allDealsMap.forEach((d, id) => {
        if (passesTagFilter(d)) filteredDealsMap.set(id, d);
      });

      if (filteredDealsMap.size === 0) return { summary: [], rows: [], totalUniqueLeads: 0 };

      // 5) Construir stagesPassedByDeal APENAS com movimentações no período + estágio inicial
      //    de deals criados no período.
      const stagesPassedByDeal = new Map<string, Set<string>>();
      const ensurePassedSet = (dealId: string) => {
        let s = stagesPassedByDeal.get(dealId);
        if (!s) { s = new Set(); stagesPassedByDeal.set(dealId, s); }
        return s;
      };

      // Atividades no período: tanto from_stage quanto to_stage contam como "passou"
      acts.forEach((act) => {
        if (!act.deal_id || !filteredDealsMap.has(act.deal_id)) return;
        const toStage = resolveStage(act.to_stage);
        if (toStage) {
          const key = normalizeStageName(toStage.name) || toStage.id;
          ensurePassedSet(act.deal_id).add(key);
        }
        const fromStage = resolveStage(act.from_stage);
        if (fromStage) {
          const key = normalizeStageName(fromStage.name) || fromStage.id;
          ensurePassedSet(act.deal_id).add(key);
        }
      });

      // Deals criados no período: estágio atual conta como "passou" no período
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      filteredDealsMap.forEach((deal) => {
        const createdMs = deal.created_at ? new Date(deal.created_at).getTime() : NaN;
        if (!Number.isFinite(createdMs)) return;
        if (createdMs < startMs || createdMs > endMs) return;
        if (!deal.stage_id) return;
        const stage = resolveStage(deal.stage_id);
        if (!stage) return;
        const key = normalizeStageName(stage.name) || stage.id;
        ensurePassedSet(deal.id).add(key);
      });

      // Inferência de trilha principal: se um deal atingiu um estágio da trilha,
      // ele automaticamente "passou" por todos os anteriores
      const MAIN_TRAIL: string[] = [
        'anamnese incompleta',
        'novo lead',
        'lead qualificado',
        'r1 agendada',
        'r1 realizada',
        'r2 agendada',
        'r2 realizada',
        'contrato pago',
        'venda realizada',
      ];

      // Estágios laterais que implicam ter atingido um pré-requisito da trilha
      const LATERAL_PREREQ: Record<string, string> = {
        'no-show': 'r1 agendada',
        'no-show r2': 'r2 agendada',
      };

      stagesPassedByDeal.forEach((stagesSet) => {
        let maxTrailIndex = -1;
        stagesSet.forEach((stageKey) => {
          const idx = MAIN_TRAIL.indexOf(stageKey);
          if (idx > maxTrailIndex) maxTrailIndex = idx;
        });
        if (maxTrailIndex >= 0) {
          for (let i = 0; i <= maxTrailIndex; i++) {
            stagesSet.add(MAIN_TRAIL[i]);
          }
        }
        // Inferência de pré-requisito de estágios laterais
        const snapshotKeys = Array.from(stagesSet);
        snapshotKeys.forEach((k) => {
          const prereq = LATERAL_PREREQ[k];
          if (prereq) {
            const idx = MAIN_TRAIL.indexOf(prereq);
            for (let i = 0; i <= idx; i++) stagesSet.add(MAIN_TRAIL[i]);
          }
        });
      });

      // 6) Origens
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

      // 7) Agregação por nome normalizado
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

      // 8) Linhas de movimentação
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

      // 9) Snapshot: somar quem está parado em cada estágio
      const movedSetByStage = new Map<string, Set<string>>(); // stageKey -> Set<dealId>
      rows.forEach((r) => {
        if (!movedSetByStage.has(r.toStageNameKey)) movedSetByStage.set(r.toStageNameKey, new Set());
        movedSetByStage.get(r.toStageNameKey)!.add(r.dealId);
      });

      // Snapshot no FIM do período: para cada deal, descobrir o estágio que ele estava em endDate.
      //    Estratégia: pegar a última stage_change com created_at <= endDate (acts já está ordenado desc).
      //    Fallback: stage_id atual SE o deal foi criado <= endDate.
      const lastStageAtEnd = new Map<string, string>(); // dealId -> stageId/clintId
      // acts está ordenado desc por created_at e já é <= endDate (filtro da query)
      acts.forEach((act) => {
        if (!act.deal_id || !filteredDealsMap.has(act.deal_id)) return;
        if (lastStageAtEnd.has(act.deal_id)) return; // já temos a mais recente
        if (act.to_stage) lastStageAtEnd.set(act.deal_id, act.to_stage);
      });

      filteredDealsMap.forEach((deal) => {
        let stageRef: string | null = lastStageAtEnd.get(deal.id) ?? null;
        if (!stageRef) {
          const createdMs = deal.created_at ? new Date(deal.created_at).getTime() : NaN;
          if (Number.isFinite(createdMs) && createdMs <= endMs && deal.stage_id) {
            stageRef = deal.stage_id;
          }
        }
        if (!stageRef) return;
        const stage = resolveStage(stageRef);
        if (!stage) return;
        const key = normalizeStageName(stage.name) || stage.id;
        const e = ensureEntry(key, stage);
        e.parados += 1;
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
      });

      // 10) Acumulado via histórico completo: uniqueLeads = todos os deals que JÁ passaram por cada estágio
      stagesPassedByDeal.forEach((stagesSet, dealId) => {
        stagesSet.forEach((stageKey) => {
          const stageInfo = stageByKey.get(stageKey) ||
            (() => {
              // Tentar resolver pelo stageKey como nome normalizado
              for (const [, v] of stageByKey) {
                if ((normalizeStageName(v.name) || v.id) === stageKey) return v;
              }
              return { id: stageKey, name: stageKey, order: 999 };
            })();
          const e = ensureEntry(stageKey, stageInfo);
          e.uniqueLeads.add(dealId);
        });
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
        .sort((a, b) => {
          const ia = STAGE_DISPLAY_ORDER.indexOf(a.stageNameKey);
          const ib = STAGE_DISPLAY_ORDER.indexOf(b.stageNameKey);
          if (ia === -1 && ib === -1) return a.stageName.localeCompare(b.stageName);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });

      console.info('[useStageMovements]', {
        activities: acts.length,
        createdInPeriod: createdInPeriod.length,
        movementDeals: movementDeals.length,
        dealsAfterFilter: filteredDealsMap.size,
        rows: rows.length,
        stages: summary.length,
      });

      return { summary, rows, totalUniqueLeads: filteredDealsMap.size };
    },
  });
}
