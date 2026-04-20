import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyChannel } from '@/lib/channelClassifier';
import type { TagFilterRule, TagOperator } from '@/components/crm/TagFilterPopover';

export interface BUFunnelData {
  universo: number;
  qualificados: number;
  semInteresse: number;
  agendadosR1: number;
  r1Realizada: number;
  noShowR1: number;
  contratoPago: number;
  r2Realizada: number;
  vendasFinais: number;
}

export interface BUFunnelByChannel {
  total: BUFunnelData;
  byChannel: Record<string, BUFunnelData>;
  channels: string[]; // ordered, only those with universo > 0
}

interface UseBUFunnelCompleteParams {
  originIds: string[] | null;
  startDate: Date;
  endDate: Date;
  tagFilters: TagFilterRule[];
  tagOperator: TagOperator;
  enabled?: boolean;
}

const normalizeName = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const normalizeTag = (t: unknown): string => {
  if (typeof t !== 'string') return '';
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').trim().toLowerCase();
};

const QUALIFICADO_KEYS = ['lead qualificado', 'qualificado'];
const SEM_INTERESSE_KEYS = ['sem interesse', 'perdido', 'desqualificado', 'sem retorno'];
const CONTRATO_PAGO_KEYS = ['contrato pago'];

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const chunk = <T,>(arr: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const empty = (): BUFunnelData => ({
  universo: 0, qualificados: 0, semInteresse: 0,
  agendadosR1: 0, r1Realizada: 0, noShowR1: 0,
  contratoPago: 0, r2Realizada: 0, vendasFinais: 0,
});

const stageMatches = (stageName: string, keys: string[]) => {
  const n = normalizeName(stageName);
  return keys.some((k) => n.includes(k));
};

const normPhone = (p: string | null | undefined) =>
  (p || '').replace(/\D/g, '').replace(/^55/, '');

export function useBUFunnelComplete({
  originIds,
  startDate,
  endDate,
  tagFilters,
  tagOperator,
  enabled = true,
}: UseBUFunnelCompleteParams) {
  const query = useQuery({
    queryKey: [
      'bu-funnel-complete-v2',
      originIds,
      startDate.toISOString(),
      endDate.toISOString(),
      tagFilters,
      tagOperator,
    ],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<BUFunnelByChannel> => {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // 1) Atividades stage_change no período (para descobrir quais deals foram tocados)
      const { data: activities, error: actErr } = await supabase
        .from('deal_activities')
        .select('deal_id, from_stage, to_stage, created_at')
        .eq('activity_type', 'stage_change')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .limit(20000);
      if (actErr) throw actErr;

      const movementDealIds = [
        ...new Set((activities || []).map((a: any) => a.deal_id).filter((id: string) => id && isValidUUID(id))),
      ];

      // 2) Carrega deals: (a) os tocados por movimentação (b) criados no período
      type DealRow = {
        id: string;
        name: string | null;
        tags: unknown;
        origin_id: string | null;
        stage_id: string | null;
        created_at: string | null;
        contact_id: string | null;
        data_source: string | null;
      };

      const dealCols = 'id, name, tags, origin_id, stage_id, created_at, contact_id, data_source';

      const movChunks = chunk(movementDealIds, 200);
      const movResults = await Promise.all(
        movChunks.map(async (ids) => {
          let q = supabase.from('crm_deals').select(dealCols).in('id', ids).is('archived_at', null);
          if (originIds && originIds.length > 0) q = q.in('origin_id', originIds);
          const { data, error } = await q;
          if (error) throw error;
          return (data || []) as DealRow[];
        }),
      );
      const movementDeals = movResults.flat();

      // (b) criados no período (paginado)
      const createdInPeriod: DealRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        let q = supabase
          .from('crm_deals')
          .select(dealCols)
          .is('archived_at', null)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (originIds && originIds.length > 0) q = q.in('origin_id', originIds);
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as DealRow[];
        createdInPeriod.push(...batch);
        if (batch.length < PAGE) break;
        if (from > 50_000) break;
      }

      const dealsMap = new Map<string, DealRow>();
      [...movementDeals, ...createdInPeriod].forEach((d) => {
        if (d?.id) dealsMap.set(d.id, d);
      });

      // 3) Filtro tags
      const passesTagFilter = (deal: DealRow) => {
        if (tagFilters.length === 0) return true;
        const dealTags = Array.isArray(deal.tags) ? (deal.tags as unknown[]) : [];
        const normalized = dealTags.map(normalizeTag).filter(Boolean);
        const evaluate = (rule: TagFilterRule) => {
          const has = normalized.includes(normalizeTag(rule.tag));
          return rule.mode === 'has' ? has : !has;
        };
        return tagOperator === 'and' ? tagFilters.every(evaluate) : tagFilters.some(evaluate);
      };

      const filteredDeals: DealRow[] = [];
      dealsMap.forEach((d) => { if (passesTagFilter(d)) filteredDeals.push(d); });

      if (filteredDeals.length === 0) {
        return { total: empty(), byChannel: {}, channels: [] };
      }

      // 4) Origens (para classificação)
      const originIdsList = [...new Set(filteredDeals.map((d) => d.origin_id).filter(Boolean) as string[])];
      const originChunks = chunk(originIdsList, 200);
      const originsResults = await Promise.all(
        originChunks.map(async (ids) => {
          const { data } = await supabase.from('crm_origins').select('id, name').in('id', ids);
          return data || [];
        }),
      );
      const originMap = new Map(originsResults.flat().map((o: any) => [o.id, o.name]));

      // 5) Stages
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, clint_id, stage_name')
        .eq('is_active', true);
      const stageNameById = new Map<string, string>();
      (stages || []).forEach((s: any) => {
        if (s.id) stageNameById.set(s.id, s.stage_name);
        if (s.clint_id) stageNameById.set(s.clint_id, s.stage_name);
      });

      // 6) Classificar cada deal por canal
      const dealChannel = new Map<string, string>();
      filteredDeals.forEach((d) => {
        const tagsArr = Array.isArray(d.tags) ? (d.tags as string[]) : [];
        const ch = classifyChannel({
          tags: tagsArr,
          originName: d.origin_id ? (originMap.get(d.origin_id) || null) : null,
          leadChannel: d.lead_channel,
          dataSource: d.data_source,
          hasA010: tagsArr.some((t) => typeof t === 'string' && t.toUpperCase().includes('A010')),
        }) || 'OUTRO';
        dealChannel.set(d.id, ch || 'OUTRO');
      });

      // 7) Universo / Qualificados / Sem Interesse / Contrato Pago (via stage atual)
      // Deduplica por contact_id ?? deal.id
      const dealKey = (d: DealRow) => d.contact_id ?? d.id;

      const buckets = new Map<string, BUFunnelData>();
      const ensureBucket = (ch: string) => {
        let b = buckets.get(ch);
        if (!b) { b = empty(); buckets.set(ch, b); }
        return b;
      };
      const total = empty();

      // sets para deduplicação por canal
      const seen: Record<keyof BUFunnelData, Map<string, Set<string>>> = {
        universo: new Map(), qualificados: new Map(), semInteresse: new Map(),
        agendadosR1: new Map(), r1Realizada: new Map(), noShowR1: new Map(),
        contratoPago: new Map(), r2Realizada: new Map(), vendasFinais: new Map(),
      } as any;
      const totalSeen: Record<keyof BUFunnelData, Set<string>> = {
        universo: new Set(), qualificados: new Set(), semInteresse: new Set(),
        agendadosR1: new Set(), r1Realizada: new Set(), noShowR1: new Set(),
        contratoPago: new Set(), r2Realizada: new Set(), vendasFinais: new Set(),
      };
      const addCount = (ch: string, k: keyof BUFunnelData, key: string) => {
        let chSet = seen[k].get(ch);
        if (!chSet) { chSet = new Set(); seen[k].set(ch, chSet); }
        if (!chSet.has(key)) {
          chSet.add(key);
          ensureBucket(ch)[k] += 1;
        }
        if (!totalSeen[k].has(key)) {
          totalSeen[k].add(key);
          total[k] += 1;
        }
      };

      filteredDeals.forEach((d) => {
        const ch = dealChannel.get(d.id)!;
        const key = dealKey(d);
        addCount(ch, 'universo', key);

        const stageName = d.stage_id ? stageNameById.get(d.stage_id) : null;
        if (stageName) {
          if (stageMatches(stageName, QUALIFICADO_KEYS)) addCount(ch, 'qualificados', key);
          if (stageMatches(stageName, SEM_INTERESSE_KEYS)) addCount(ch, 'semInteresse', key);
          if (stageMatches(stageName, CONTRATO_PAGO_KEYS)) addCount(ch, 'contratoPago', key);
        }
      });

      // 8) Agenda R1/R2 — slots no período
      const { data: slots } = await supabase
        .from('meeting_slots')
        .select('id, meeting_type, scheduled_at')
        .gte('scheduled_at', startIso)
        .lte('scheduled_at', endIso)
        .in('meeting_type', ['r1', 'r2']);

      const r1SlotIds = new Set<string>();
      const r2SlotIds = new Set<string>();
      (slots || []).forEach((s: any) => {
        if (s.meeting_type === 'r1') r1SlotIds.add(s.id);
        if (s.meeting_type === 'r2') r2SlotIds.add(s.id);
      });

      type Att = {
        contact_id: string | null;
        deal_id: string | null;
        meeting_slot_id: string;
        status: string | null;
        contract_paid_at: string | null;
      };
      const attendees: Att[] = [];
      const allSlotIds = [...r1SlotIds, ...r2SlotIds];
      if (allSlotIds.length > 0) {
        const PAGE2 = 1000;
        for (let i = 0; i < allSlotIds.length; i += PAGE2) {
          const batch = allSlotIds.slice(i, i + PAGE2);
          const { data } = await supabase
            .from('meeting_slot_attendees')
            .select('contact_id, deal_id, meeting_slot_id, status, contract_paid_at')
            .in('meeting_slot_id', batch);
          attendees.push(...((data as any[]) || []));
        }
      }

      // Para classificar attendees por canal, precisamos do canal do deal_id.
      // Buscamos os deals dos attendees que não estão no map atual.
      const missingDealIds = [
        ...new Set(
          attendees
            .map((a) => a.deal_id)
            .filter((id): id is string => !!id && isValidUUID(id) && !dealChannel.has(id)),
        ),
      ];
      if (missingDealIds.length > 0) {
        const mChunks = chunk(missingDealIds, 200);
        const mResults = await Promise.all(
          mChunks.map(async (ids) => {
            let q = supabase.from('crm_deals').select(dealCols).in('id', ids).is('archived_at', null);
            if (originIds && originIds.length > 0) q = q.in('origin_id', originIds);
            const { data } = await q;
            return (data || []) as DealRow[];
          }),
        );
        const extraDeals = mResults.flat();
        // origens faltantes
        const extraOriginIds = [
          ...new Set(extraDeals.map((d) => d.origin_id).filter((x): x is string => !!x && !originMap.has(x))),
        ];
        if (extraOriginIds.length > 0) {
          const eChunks = chunk(extraOriginIds, 200);
          const eRes = await Promise.all(
            eChunks.map(async (ids) => {
              const { data } = await supabase.from('crm_origins').select('id, name').in('id', ids);
              return data || [];
            }),
          );
          eRes.flat().forEach((o: any) => originMap.set(o.id, o.name));
        }
        extraDeals.forEach((d) => {
          const tagsArr = Array.isArray(d.tags) ? (d.tags as string[]) : [];
          const ch = classifyChannel({
            tags: tagsArr,
            originName: d.origin_id ? (originMap.get(d.origin_id) || null) : null,
            leadChannel: d.lead_channel,
            dataSource: d.data_source,
            hasA010: tagsArr.some((t) => typeof t === 'string' && t.toUpperCase().includes('A010')),
          }) || 'OUTRO';
          dealChannel.set(d.id, ch || 'OUTRO');
          dealsMap.set(d.id, d);
        });
      }

      // contatos por deal para chave de dedup nos attendees
      const dealContact = new Map<string, string | null>();
      dealsMap.forEach((d, id) => dealContact.set(id, d.contact_id));

      attendees.forEach((a) => {
        const dealId = a.deal_id;
        const ch = dealId ? (dealChannel.get(dealId) || 'OUTRO') : 'OUTRO';
        const key = a.contact_id ?? (dealId ? (dealContact.get(dealId) ?? dealId) : null);
        if (!key) return;
        const isR1 = r1SlotIds.has(a.meeting_slot_id);
        const isR2 = r2SlotIds.has(a.meeting_slot_id);
        const status = (a.status || '').toLowerCase();

        if (isR1) {
          addCount(ch, 'agendadosR1', key);
          if (status === 'completed' || status === 'realizada') addCount(ch, 'r1Realizada', key);
          if (status === 'no_show') addCount(ch, 'noShowR1', key);
        }
        if (isR2 && (status === 'completed' || status === 'realizada')) {
          addCount(ch, 'r2Realizada', key);
        }
        if (status === 'contract_paid' || a.contract_paid_at) {
          addCount(ch, 'contratoPago', key);
        }
      });

      // 9) Vendas finais Hubla (parceria) — atribui ao canal do lead que originou o deal
      const { data: hubla } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, sale_date, sale_status, product_category')
        .eq('sale_status', 'completed')
        .ilike('product_category', '%parceria%')
        .gte('sale_date', startIso)
        .lte('sale_date', endIso);

      // construir índices email/phone -> canal a partir dos contatos do universo
      // precisamos buscar emails/phones dos contacts dos deals filtrados
      const contactIds = [...new Set(filteredDeals.map((d) => d.contact_id).filter((x): x is string => !!x))];
      const contactEmail = new Map<string, string>();
      const contactPhone = new Map<string, string>();
      if (contactIds.length > 0) {
        const cChunks = chunk(contactIds, 200);
        const cRes = await Promise.all(
          cChunks.map(async (ids) => {
            const { data } = await supabase
              .from('crm_contacts')
              .select('id, email, phone')
              .in('id', ids);
            return data || [];
          }),
        );
        cRes.flat().forEach((c: any) => {
          if (c.email) contactEmail.set(c.email.toLowerCase(), c.id);
          if (c.phone) contactPhone.set(normPhone(c.phone), c.id);
        });
      }
      // mapear contact -> canal (prioriza primeiro deal)
      const contactToChannel = new Map<string, string>();
      filteredDeals.forEach((d) => {
        if (d.contact_id && !contactToChannel.has(d.contact_id)) {
          contactToChannel.set(d.contact_id, dealChannel.get(d.id) || 'OUTRO');
        }
      });

      (hubla || []).forEach((tx: any) => {
        const email = (tx.customer_email || '').toLowerCase();
        const phone = normPhone(tx.customer_phone);
        const cId = (email && contactEmail.get(email)) || (phone && contactPhone.get(phone));
        const ch = (cId && contactToChannel.get(cId)) || 'OUTRO';
        const key = cId || `hubla-${tx.id}`;
        addCount(ch, 'vendasFinais', key);
      });

      // 10) Ordenar canais por universo desc, ocultar zero
      const channels = Array.from(buckets.entries())
        .filter(([, v]) => v.universo > 0)
        .sort((a, b) => b[1].universo - a[1].universo)
        .map(([k]) => k);

      const byChannel: Record<string, BUFunnelData> = {};
      channels.forEach((c) => { byChannel[c] = buckets.get(c)!; });

      return { total, byChannel, channels };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
