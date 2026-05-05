import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { format } from 'date-fns';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';

/**
 * Funil por Canal (FOTOGRAFIA POR JANELA).
 *
 * Cada coluna é independente e conta eventos cuja data-âncora cai na janela
 * do filtro (sem cohort sequencial / sem follow-up de 30 dias):
 *   - Entradas       → deals com `created_at` na janela (base)
 *   - R1 Agend.      → R1 attendees com `scheduled_at` na janela
 *   - R1 Realiz.     → idem, desfecho 'completed'
 *   - No-Show        → idem, desfecho 'no_show'
 *   - Contrato Pago  → attendees com `contract_paid_at` na janela
 *   - R2 / Aprov.    → linhas do carrinho R2 na janela
 *   - Venda Final    → vendas Hubla com `sale_date` na janela
 *
 * Dedup por deal (ou email para vendas) dentro de cada coluna.
 */

const CHANNEL_LABELS: Record<string, string> = {
  A010: 'A010',
  ANAMNESE: 'ANAMNESE',
  ANAMNESE_INCOMPLETA: 'ANAMNESE INCOMPLETA',
  OUTROS: 'OUTROS',
};
export function displayChannelLabel(raw: string): string {
  return CHANNEL_LABELS[raw] || raw;
}

export interface ChannelFunnelRow {
  channel: string;
  channelLabel: string;
  entradas: number;          // = r1Agendada (tamanho do cohort) — compat
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  contratoPago: number;
  r2Agendada: number;
  r2Realizada: number;
  aprovados: number;
  reprovados: number;
  proximaSemana: number;
  vendaFinal: number;
  faturamentoBruto: number;
  faturamentoLiquido: number;
  // conversões
  r1AgToReal: number;
  r1RealToContrato: number;
  aprovadoToVenda: number;
  entradaToVenda: number;    // = cohort → venda final
  taxaNoShow: number;
}

export type FunnelMetricKey =
  | 'entradas' | 'r1Agendada' | 'r1Realizada' | 'noShow' | 'contratoPago'
  | 'r2Agendada' | 'r2Realizada' | 'aprovados' | 'reprovados' | 'proximaSemana'
  | 'vendaFinal' | 'faturamentoBruto' | 'faturamentoLiquido';

export interface FunnelDetailItem {
  id: string;            // deal_id ou transaction_id (para vendas)
  dealId: string | null; // para abrir no CRM
  name: string | null;
  email: string | null;
  phone: string | null;
  date: string;          // data do evento (created_at / scheduled_at / contract_paid_at / sale_date)
  channel: string;
  status: string | null;
  product: string | null;     // só para vendas
  bruto: number | null;       // só para vendas
  liquido: number | null;     // só para vendas
}

export type FunnelDetails = Record<string, Record<FunnelMetricKey, FunnelDetailItem[]>>;

interface CarrinhoFunnelRow {
  deal_id: string | null;
  r2_status_name: string | null;
  meeting_status: string | null;
  attendee_status: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  attendee_phone: string | null;
}

const phoneSuffix = (phone: string | null | undefined): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};

const A010_FRESH_WINDOW_DAYS = 30;

/**
 * Classificação de canal — alinhada com a Agenda R1 (`classifySimple` em
 * src/components/crm/MeetingsList.tsx). Regras:
 * - A010 buyer = existe venda em hubla_transactions com product_category='a010'
 *   e sale_status='completed' (lookup por email/telefone). Usa a sale_date
 *   MAIS RECENTE.
 * - Janela de 30 dias é medida entre a `referenceDate` (data do evento: deal
 *   created_at, scheduled_at, etc.) e a sale_date mais recente.
 * - Tag de ANAMNESE conta APENAS se for exatamente "ANAMNESE",
 *   "ANAMNESE-INSTA" ou "ANAMNESE INSTA" (não vale LIVE / LANÇ).
 * - A010 esfriado (>30d) SEM tag ANAMNESE continua A010.
 */
function classifyChannelWith30dRule(opts: {
  tags: string[];
  /** sale_date MAIS RECENTE do A010 do lead (null se não for buyer) */
  mostRecentA010Purchase: Date | null;
  referenceDate: Date;
}): string {
  const { tags, mostRecentA010Purchase, referenceDate } = opts;
  const norm = tags.map((t) => (t || '').trim().toUpperCase());
  // SOMENTE tag exata "ANAMNESE" (anamnese completa). NÃO contar ANAMNESE-INSTA, LIVE, LANÇ etc.
  const hasAnamneseTag = norm.some((t) => t === 'ANAMNESE');
  const hasAnamneseIncompletaTag = norm.some((t) => t === 'ANAMNESE-INCOMPLETA');
  const isBuyer = mostRecentA010Purchase !== null;
  const ageDays = isBuyer
    ? (referenceDate.getTime() - mostRecentA010Purchase!.getTime()) / 86_400_000
    : null;
  const isStale = ageDays !== null && ageDays > A010_FRESH_WINDOW_DAYS;

  // Buyer A010 recente (≤30d) → A010, mesmo com tag ANAMNESE
  if (isBuyer && !isStale) return 'A010';
  // Buyer esfriado COM tag ANAMNESE → reclassifica
  if (isBuyer && isStale && hasAnamneseTag) return 'ANAMNESE';
  // Buyer esfriado SEM tag → continua A010
  if (isBuyer && isStale && !hasAnamneseTag) return 'A010';
  // Não-buyer com tag ANAMNESE → ANAMNESE
  if (hasAnamneseTag) return 'ANAMNESE';
  // Não-buyer com tag ANAMNESE-INCOMPLETA → ANAMNESE INCOMPLETA
  if (hasAnamneseIncompletaTag) return 'ANAMNESE_INCOMPLETA';
  return 'OUTROS';
}

const parseTags = (tagsRaw: any[] | null | undefined): string[] =>
  (tagsRaw || []).map((t: any) => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { return (JSON.parse(t)?.name || t).toUpperCase(); } catch { return t.toUpperCase(); }
      }
      return t.toUpperCase();
    }
    return (t?.name || '').toUpperCase();
  });

// Produtos que contam como Venda Final de Parceria.
const PARCERIA_VENDA_PRODUCTS = new Set<string>([
  ...ALLOWED_BILLING_PRODUCTS,
  'A005 - MCF P2',
]);

// Mapeamento BU → origin_ids. Hardcoded conforme bu_origin_mapping.
const BU_ORIGIN_IDS: Record<string, string[]> = {
  incorporador: [
    'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', // PIPELINE INSIDE SALES
    '7431cf4a-dc29-4208-95a6-28a499a06dac', // PILOTO ANAMNESE / INDICAÇÃO
  ],
};

// BU → squad string usado por get_sdrs_for_squad_in_period e get_sdr_metrics_from_agenda
const BU_SQUAD: Record<string, string> = {
  incorporador: 'incorporador',
};

interface DealMeta {
  id: string;
  origin_id: string | null;
  tags: any[] | null;
  created_at: string;
  contact_id: string | null;
  email: string | null;
  channel: string;
}

export function useChannelFunnelReport(dateRange: DateRange | undefined, bu?: BusinessUnit) {
  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
  const endDate = dateRange?.to
    ? format(dateRange.to, 'yyyy-MM-dd')
    : (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null);

  const buOrigins = bu ? (BU_ORIGIN_IDS[bu] || []) : [];
  const buSquad = bu ? (BU_SQUAD[bu] || null) : null;

  const windowStartIso = startDate ? new Date(`${startDate}T00:00:00-03:00`).toISOString() : null;
  const windowEndIso = endDate ? new Date(`${endDate}T23:59:59-03:00`).toISOString() : null;

  // ================================================================
  // 0. SDRs ATIVOS NO SQUAD/PERÍODO — espelha lista usada pelo KPI
  //    "R1 AGENDADA" do header /crm/reunioes-equipe (enrichedKPIs).
  //    Usa get_sdrs_for_squad_in_period + cross-check user_roles para
  //    excluir admins/managers/closers que tiveram booking no período.
  // ================================================================
  const { data: allowedSdrEmails = new Set<string>() } = useQuery<Set<string>>({
    queryKey: ['funnel-allowed-sdrs', startDate, endDate, buSquad],
    queryFn: async () => {
      const empty = new Set<string>();
      if (!startDate || !endDate || !buSquad) return empty;
      const { data: sdrsInPeriod, error } = await supabase.rpc('get_sdrs_for_squad_in_period' as any, {
        p_squad: buSquad,
        p_start: new Date(`${startDate}T00:00:00-03:00`).toISOString(),
        p_end: new Date(`${endDate}T23:59:59-03:00`).toISOString(),
      });
      if (error) { console.error('[funnel] get_sdrs_for_squad_in_period error', error); return empty; }
      const sdrEmailsRaw = ((sdrsInPeriod as any[]) || [])
        .map(s => (s.email || '').toLowerCase())
        .filter(Boolean);
      if (sdrEmailsRaw.length === 0) return empty;
      // Cross-check com user_roles (mesma regra do ReunioesEquipe.tsx)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', sdrEmailsRaw);
      const profileIds = (profiles || []).map((p: any) => p.id);
      const blockedIds = new Set<string>();
      if (profileIds.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', profileIds)
          .in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo', 'closer', 'closer_sombra']);
        (roles || []).forEach((r: any) => blockedIds.add(r.user_id));
      }
      const blockedEmails = new Set<string>(
        (profiles || [])
          .filter((p: any) => blockedIds.has(p.id))
          .map((p: any) => (p.email || '').toLowerCase())
      );
      return new Set(sdrEmailsRaw.filter(e => !blockedEmails.has(e)));
    },
    enabled: !!startDate && !!endDate && !!buSquad,
    staleTime: 60_000,
  });

  // ================================================================
  // 1. R1 na janela — attendees R1 cujo scheduled_at cai na janela.
  //    Sem follow-up: cada coluna é uma fotografia independente.
  // ================================================================
  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ['funnel-window-r1', startDate, endDate, bu, buOrigins.join(',')],
    queryFn: async (): Promise<{
      // deal_id → âncora (R1 scheduled_at na janela)
      cohortDeals: Map<string, { anchor: string; followupEnd: string }>;
      // deal_id → desfecho final R1 entre attendees R1 da janela
      r1Outcome: Map<string, 'completed' | 'no_show' | 'pending'>;
      // deal_id → contract_paid_at na janela
      contratoPagoDeals: Set<string>;
      // attendees R1 individuais (1 linha por attendee/slot na janela)
      r1Attendees: Array<{ dealId: string; scheduledAt: string; outcome: 'completed' | 'no_show' | 'pending' }>;
      // R1 attendees alinhados com KPI (1 linha por sdr+deal+dia)
      r1Aligned: Array<{ dealId: string; sdrEmail: string; meetingDay: string; scheduledAt: string; isRealized: boolean; isNoShow: boolean }>;
    }> => {
      const empty = {
        cohortDeals: new Map<string, { anchor: string; followupEnd: string }>(),
        r1Outcome: new Map<string, 'completed' | 'no_show' | 'pending'>(),
        contratoPagoDeals: new Set<string>(),
        r1Attendees: [] as Array<{ dealId: string; scheduledAt: string; outcome: 'completed' | 'no_show' | 'pending' }>,
        r1Aligned: [] as Array<{ dealId: string; sdrEmail: string; meetingDay: string; scheduledAt: string; isRealized: boolean; isNoShow: boolean }>,
      };
      if (!startDate || !endDate || buOrigins.length === 0) return empty;

      // 1a. R1 attendees com scheduled_at na janela
      const attendees: any[] = [];
      const pageSize = 1000;
      let from = 0, more = true;
      while (more && from < 30000) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id, status, contract_paid_at,
            meeting_slots!inner(scheduled_at, meeting_type, status),
            crm_deals!deal_id(origin_id)
          `)
          .eq('meeting_slots.meeting_type', 'r1')
          .gte('meeting_slots.scheduled_at', windowStartIso!)
          .lte('meeting_slots.scheduled_at', windowEndIso!)
          .range(from, from + pageSize - 1);
        if (error) { console.error('[funnel-window] attendees', error); break; }
        const batch = data || [];
        attendees.push(...batch);
        more = batch.length >= pageSize;
        from += pageSize;
      }

      const buOriginsSet = new Set(buOrigins);
      const cohortDeals = new Map<string, { anchor: string; followupEnd: string }>();
      const r1Outcome = new Map<string, 'completed' | 'no_show' | 'pending'>();
      const contratoPagoDeals = new Set<string>();
      const r1Attendees: Array<{ dealId: string; scheduledAt: string; outcome: 'completed' | 'no_show' | 'pending' }> = [];
      const rank = (s: string) => s === 'completed' ? 3 : s === 'no_show' ? 2 : 1;

      for (const a of attendees) {
        const dealId = a.deal_id;
        const dealOrigin = a.crm_deals?.origin_id;
        if (!dealId || !buOriginsSet.has(dealOrigin)) continue;
        const slotStatus = (a.meeting_slots?.status || '').toLowerCase();
        const attStatus = (a.status || '').toLowerCase();
        if (slotStatus === 'cancelled' || slotStatus === 'rescheduled') continue;
        if (attStatus === 'cancelled' || attStatus === 'rescheduled') continue;
        const sched: string | null = a.meeting_slots?.scheduled_at || null;
        if (!sched) continue;
        const existing = cohortDeals.get(dealId);
        if (!existing || new Date(sched) < new Date(existing.anchor)) {
          cohortDeals.set(dealId, { anchor: sched, followupEnd: windowEndIso! });
        }
        let effective: 'completed' | 'no_show' | 'pending' = 'pending';
        if (slotStatus === 'completed' || attStatus === 'completed') effective = 'completed';
        else if (slotStatus === 'no_show' || attStatus === 'no_show') effective = 'no_show';
        const prev = r1Outcome.get(dealId) || 'pending';
        if (rank(effective) > rank(prev)) r1Outcome.set(dealId, effective);
        // 1 linha por attendee — alinhado com KPI da Agenda (sem dedupe por deal)
        r1Attendees.push({ dealId, scheduledAt: sched, outcome: effective });

        // Contrato pago na janela
        if (a.contract_paid_at && a.contract_paid_at >= windowStartIso! && a.contract_paid_at <= windowEndIso!) {
          contratoPagoDeals.add(dealId);
        }
      }

      // R1 alinhado com KPI da Equipe — mesmo filtro de squad histórico, is_partner=false, etc.
      const r1Aligned: Array<{ dealId: string; sdrEmail: string; meetingDay: string; scheduledAt: string; isRealized: boolean; isNoShow: boolean }> = [];
      if (bu) {
        const { data: alignedRows, error: alignedErr } = await supabase.rpc('get_funnel_r1_attendees_aligned' as any, {
          start_date: startDate,
          end_date: endDate,
          bu_filter: bu,
        });
        if (alignedErr) {
          console.warn('[funnel] get_funnel_r1_attendees_aligned error', alignedErr);
        } else {
          (alignedRows || []).forEach((r: any) => {
            r1Aligned.push({
              dealId: r.deal_id,
              sdrEmail: r.sdr_email,
              meetingDay: r.meeting_day,
              scheduledAt: r.scheduled_at,
              isRealized: !!r.is_realized,
              isNoShow: !!r.is_noshow,
            });
          });
        }
      }

      return { cohortDeals, r1Outcome, contratoPagoDeals, r1Attendees, r1Aligned };
    },
    enabled: !!startDate && !!endDate && buOrigins.length > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 1c. ENTRADAS — deals criados na janela (independente de R1).
  // ================================================================
  const { data: entradasDeals = new Set<string>(), isLoading: loadingEntradas } = useQuery<Set<string>>({
    queryKey: ['funnel-entradas', startDate, endDate, bu, buOrigins.join(',')],
    queryFn: async () => {
      const s = new Set<string>();
      if (!startDate || !endDate || buOrigins.length === 0) return s;
      const pageSize = 1000;
      let from = 0, more = true;
      while (more && from < 30000) {
        const { data, error } = await supabase
          .from('crm_deals')
          .select('id')
          .in('origin_id', buOrigins)
          .gte('created_at', windowStartIso!)
          .lte('created_at', windowEndIso!)
          .range(from, from + pageSize - 1);
        if (error) { console.error('[funnel-entradas] error', error); break; }
        const batch = data || [];
        batch.forEach((d: any) => s.add(d.id));
        more = batch.length >= pageSize;
        from += pageSize;
      }
      return s;
    },
    enabled: !!startDate && !!endDate && buOrigins.length > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 1d. CONTRATO PAGO — alinhado ao KPI "CONTRATOS" do header.
  //     Conta attendees R1 com contract_paid_at na janela, filtrados
  //     pelos SDRs ativos do squad (allowedSdrEmails) e is_partner=false.
  //     Independente de a R1 estar na janela.
  // ================================================================
  const allowedEmailsKey = useMemo(() => Array.from(allowedSdrEmails).sort().join(','), [allowedSdrEmails]);
  const { data: contratoPagoAligned = [] as Array<{ dealId: string; sdrId: string }>, isLoading: loadingContratos } = useQuery<Array<{ dealId: string; sdrId: string }>>({
    queryKey: ['funnel-contratos-aligned', startDate, endDate, bu, allowedEmailsKey],
    queryFn: async () => {
      const out: Array<{ dealId: string; sdrId: string }> = [];
      if (!startDate || !endDate || allowedSdrEmails.size === 0) return out;
      const allowedList = Array.from(allowedSdrEmails);
      // 1) Resolver profile.id dos SDRs ativos
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', allowedList);
      const sdrIds = (profs || []).map((p: any) => p.id);
      if (sdrIds.length === 0) return out;
      // 2) Buscar attendees com contract_paid_at na janela
      const pageSize = 1000;
      let from = 0, more = true;
      while (more && from < 30000) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select('deal_id, booked_by, is_partner, contract_paid_at, meeting_slots!inner(meeting_type)')
          .eq('is_partner', false)
          .eq('meeting_slots.meeting_type', 'r1')
          .in('booked_by', sdrIds)
          .gte('contract_paid_at', windowStartIso!)
          .lte('contract_paid_at', windowEndIso!)
          .range(from, from + pageSize - 1);
        if (error) { console.error('[funnel-contratos-aligned] error', error); break; }
        const batch = data || [];
        batch.forEach((r: any) => {
          if (r.deal_id && r.booked_by) out.push({ dealId: r.deal_id, sdrId: r.booked_by });
        });
        more = batch.length >= pageSize;
        from += pageSize;
      }
      return out;
    },
    enabled: !!startDate && !!endDate && allowedSdrEmails.size > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 2. R2/Carrinho — janela exata (já estava correto)
  // ================================================================
  const { data: carrinhoRows = [], isLoading: loadingCarrinho } = useQuery<CarrinhoFunnelRow[]>({
    queryKey: ['funnel-carrinho-range', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase.rpc('get_carrinho_r2_attendees', {
        p_week_start: startDate,
        p_window_start: windowStartIso!,
        p_window_end: windowEndIso!,
        p_apply_contract_cutoff: false,
        p_previous_cutoff: windowStartIso!,
      });
      if (error) { console.warn('[funnel] carrinho RPC error', error); return []; }
      return (data || []).map((r: any) => ({
        deal_id: r.deal_id,
        r2_status_name: r.r2_status_name,
        meeting_status: r.meeting_status,
        attendee_status: r.attendee_status,
        contact_email: r.contact_email,
        contact_phone: r.contact_phone,
        attendee_phone: r.attendee_phone,
      }));
    },
    enabled: !!startDate && !!endDate,
    staleTime: 60_000,
  });

  // ================================================================
  // 3. METADATA dos deals envolvidos (para classificar canal)
  //    Junta: dealsCreated + r1Deals + r2Deals + contratoPagoDeals
  // ================================================================
  const allInvolvedDealIds = useMemo(() => {
    const s = new Set<string>();
    (cohort?.cohortDeals || new Map()).forEach((_v, id) => s.add(id));
    (cohort?.contratoPagoDeals || new Set()).forEach(id => s.add(id));
    carrinhoRows.forEach(c => { if (c.deal_id) s.add(c.deal_id); });
    entradasDeals.forEach(id => s.add(id));
    contratoPagoAligned.forEach(({ dealId }) => s.add(dealId));
    return Array.from(s);
  }, [cohort, carrinhoRows, entradasDeals, contratoPagoAligned]);

  const { data: dealMeta = new Map<string, DealMeta>(), isLoading: loadingMeta } = useQuery<Map<string, DealMeta>>({
    queryKey: ['funnel-deal-meta', allInvolvedDealIds.join(',').slice(0, 200), allInvolvedDealIds.length],
    queryFn: async () => {
      const m = new Map<string, DealMeta>();
      if (allInvolvedDealIds.length === 0) return m;

      const deals: any[] = [];
      const chunkSize = 200;
      for (let i = 0; i < allInvolvedDealIds.length; i += chunkSize) {
        const chunk = allInvolvedDealIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('crm_deals')
          .select('id, origin_id, tags, created_at, contact_id, crm_contacts!contact_id(email)')
          .in('id', chunk);
        if (error) { console.warn('[funnel] dealMeta error', error); continue; }
        deals.push(...(data || []));
      }

      // Buscar a venda A010 MAIS RECENTE de cada email — alinhado com a Agenda R1.
      // Usa product_category='a010' (NÃO product_name ILIKE '%A010%').
      const emails = Array.from(new Set(
        deals.map(d => (d.crm_contacts?.email || '').toLowerCase().trim()).filter(Boolean)
      ));
      const mostRecentA010ByEmail = new Map<string, Date>();
      for (let i = 0; i < emails.length; i += 200) {
        const chunk = emails.slice(i, i + 200);
        if (chunk.length === 0) continue;
        const { data: a010Tx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .in('customer_email', chunk);
        (a010Tx || []).forEach((r: any) => {
          const e = (r.customer_email || '').toLowerCase().trim();
          if (!e || !r.sale_date) return;
          const d = new Date(r.sale_date);
          const prev = mostRecentA010ByEmail.get(e);
          if (!prev || d > prev) mostRecentA010ByEmail.set(e, d);
        });
      }

      for (const d of deals) {
        const email = (d.crm_contacts?.email || '').toLowerCase().trim() || null;
        const tags = parseTags(d.tags);
        const channel = classifyChannelWith30dRule({
          tags,
          mostRecentA010Purchase: email ? (mostRecentA010ByEmail.get(email) || null) : null,
          referenceDate: new Date(d.created_at),
        });
        m.set(d.id, {
          id: d.id,
          origin_id: d.origin_id,
          tags: d.tags,
          created_at: d.created_at,
          contact_id: d.contact_id,
          email,
          channel,
        });
      }
      return m;
    },
    enabled: allInvolvedDealIds.length > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 4. VENDA FINAL — vendas de parceria com sale_date na janela.
  //    SEM filtro de "primeira-compra-da-vida" (inclui upsells/recompras).
  //    Dedupe por email dentro da janela.
  // ================================================================
  const { data: refPrices = new Map<string, number>() } = useQuery<Map<string, number>>({
    queryKey: ['funnel-ref-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_configurations')
        .select('product_name, reference_price')
        .in('product_category', ['incorporador', 'parceria'])
        .eq('is_active', true);
      if (error) { console.error('[funnel] refPrices error', error); return new Map(); }
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => {
        m.set(r.product_name, Number(r.reference_price) || 0);
      });
      return m;
    },
    staleTime: 5 * 60_000,
  });

  const { data: vendasFinal = [], isLoading: loadingVendas } = useQuery<Array<{
    email: string;
    phone: string;
    bruto: number;
    liquido: number;
    saleDate: Date;
    product: string;
  }>>({
    queryKey: ['funnel-vendas-final-v2', startDate, endDate, refPrices.size],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const { data: tx, error } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, product_name, product_price, sale_date')
        .in('product_category', ['incorporador', 'parceria'])
        .eq('sale_status', 'completed')
        .in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
        .gte('sale_date', windowStartIso!)
        .lte('sale_date', windowEndIso!)
        .order('sale_date', { ascending: true })
        .limit(5000);
      if (error) { console.error('[funnel] vendasFinal error', error); return []; }
      const valid = (tx || []).filter((t: any) => PARCERIA_VENDA_PRODUCTS.has(t.product_name));
      const seen = new Set<string>();
      const result: any[] = [];
      for (const t of valid as any[]) {
        const email = (t.customer_email || '').toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        const liquido = Number(t.product_price) || 0;
        const bruto = refPrices.get(t.product_name) || liquido;
        result.push({
          email,
          phone: phoneSuffix(t.customer_phone),
          bruto,
          liquido,
          saleDate: new Date(t.sale_date),
          product: t.product_name,
        });
      }
      return result;
    },
    enabled: !!startDate && !!endDate && refPrices.size > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 5. Mapear email → canal (via deals da BU que têm aquele email)
  //    para classificar vendas. Fallback: OUTROS.
  // ================================================================
  const emailToChannel = useMemo(() => {
    const m = new Map<string, string>();
    dealMeta.forEach(d => {
      if (d.email) m.set(d.email, d.channel);
    });
    return m;
  }, [dealMeta]);

  // ================================================================
  // 5b. Lookup de nome/telefone do contato (para drill-down)
  //     Busca leve em crm_contacts apenas para os deals envolvidos.
  // ================================================================
  const contactIdsToLoad = useMemo(() => {
    const s = new Set<string>();
    dealMeta.forEach(d => { if (d.contact_id) s.add(d.contact_id); });
    return Array.from(s);
  }, [dealMeta]);

  const { data: contactInfo = new Map<string, { name: string | null; phone: string | null; email: string | null }>() } =
    useQuery<Map<string, { name: string | null; phone: string | null; email: string | null }>>({
      queryKey: ['funnel-contact-info', contactIdsToLoad.join(',').slice(0, 200), contactIdsToLoad.length],
      queryFn: async () => {
        const m = new Map<string, { name: string | null; phone: string | null; email: string | null }>();
        if (contactIdsToLoad.length === 0) return m;
        for (let i = 0; i < contactIdsToLoad.length; i += 200) {
          const chunk = contactIdsToLoad.slice(i, i + 200);
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name, phone, email')
            .in('id', chunk);
          (data || []).forEach((c: any) => {
            m.set(c.id, { name: c.name || null, phone: c.phone || null, email: c.email || null });
          });
        }
        return m;
      },
      enabled: contactIdsToLoad.length > 0,
      staleTime: 60_000,
    });

  // Para vendas cujo email não está em dealMeta, precisamos buscar o deal pelo email
  // e classificar. Faremos isso só para emails que faltarem.
  const missingVendaEmails = useMemo(() => {
    return vendasFinal.filter(v => !emailToChannel.has(v.email)).map(v => v.email);
  }, [vendasFinal, emailToChannel]);

  const { data: extraEmailChannels = new Map<string, string>() } = useQuery<Map<string, string>>({
    queryKey: ['funnel-extra-email-channels', missingVendaEmails.join(',').slice(0, 200), missingVendaEmails.length, buOrigins.join(',')],
    queryFn: async () => {
      const m = new Map<string, string>();
      if (missingVendaEmails.length === 0 || buOrigins.length === 0) return m;

      // Buscar deals da BU pelos emails faltantes
      const deals: any[] = [];
      for (let i = 0; i < missingVendaEmails.length; i += 200) {
        const chunk = missingVendaEmails.slice(i, i + 200);
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .in('email', chunk);
        const contactIds = (contacts || []).map((c: any) => c.id);
        const emailById = new Map<string, string>();
        (contacts || []).forEach((c: any) => emailById.set(c.id, (c.email || '').toLowerCase().trim()));
        if (contactIds.length === 0) continue;
        const { data: ds } = await supabase
          .from('crm_deals')
          .select('id, contact_id, origin_id, tags, created_at')
          .in('contact_id', contactIds)
          .in('origin_id', buOrigins);
        (ds || []).forEach((d: any) => {
          deals.push({ ...d, email: emailById.get(d.contact_id) });
        });
      }

      // Lookup A010 — alinhado com a Agenda R1 (product_category='a010', sale_date mais recente)
      const emails = Array.from(new Set(deals.map(d => d.email).filter(Boolean)));
      const mostRecentA010ByEmail = new Map<string, Date>();
      for (let i = 0; i < emails.length; i += 200) {
        const chunk = emails.slice(i, i + 200);
        if (chunk.length === 0) continue;
        const { data: a010Tx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .in('customer_email', chunk);
        (a010Tx || []).forEach((r: any) => {
          const e = (r.customer_email || '').toLowerCase().trim();
          if (!e || !r.sale_date) return;
          const d = new Date(r.sale_date);
          const prev = mostRecentA010ByEmail.get(e);
          if (!prev || d > prev) mostRecentA010ByEmail.set(e, d);
        });
      }

      // Para cada email, pegar o deal mais recente e classificar
      const byEmail = new Map<string, any>();
      for (const d of deals) {
        const e = d.email;
        if (!e) continue;
        const existing = byEmail.get(e);
        if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
          byEmail.set(e, d);
        }
      }
      byEmail.forEach((d, e) => {
        const ch = classifyChannelWith30dRule({
          tags: parseTags(d.tags),
          mostRecentA010Purchase: mostRecentA010ByEmail.get(e) || null,
          referenceDate: new Date(d.created_at),
        });
        m.set(e, ch);
      });
      return m;
    },
    enabled: missingVendaEmails.length > 0,
    staleTime: 60_000,
  });

  // ================================================================
  // 6. AGREGAÇÃO POR CANAL (3 buckets fixos)
  // ================================================================
  const { rows, totals, details } = useMemo(() => {
    const FUNNEL_CHANNELS = ['A010', 'ANAMNESE', 'ANAMNESE_INCOMPLETA', 'OUTROS'];
    const blank = () => ({
      entradas: 0, r1Agendada: 0, r1Realizada: 0, noShow: 0, contratoPago: 0,
      r2Agendada: 0, r2Realizada: 0, aprovados: 0, reprovados: 0,
      proximaSemana: 0, vendaFinal: 0, faturamentoBruto: 0, faturamentoLiquido: 0,
    });
    const map = new Map<string, ReturnType<typeof blank>>();
    FUNNEL_CHANNELS.forEach(c => map.set(c, blank()));
    const get = (c: string) => {
      if (!map.has(c)) map.set(c, blank());
      return map.get(c)!;
    };
    const channelOf = (dealId: string | null | undefined): string => {
      if (!dealId) return 'OUTROS';
      return dealMeta.get(dealId)?.channel || 'OUTROS';
    };

    // ---- coleta de detalhes (drill-down) ----
    const blankDetails = (): Record<FunnelMetricKey, FunnelDetailItem[]> => ({
      entradas: [], r1Agendada: [], r1Realizada: [], noShow: [], contratoPago: [],
      r2Agendada: [], r2Realizada: [], aprovados: [], reprovados: [], proximaSemana: [],
      vendaFinal: [], faturamentoBruto: [], faturamentoLiquido: [],
    });
    const det: FunnelDetails = {
      A010: blankDetails(), ANAMNESE: blankDetails(), ANAMNESE_INCOMPLETA: blankDetails(), OUTROS: blankDetails(), TOTAL: blankDetails(),
    };
    const pushDet = (channel: string, metric: FunnelMetricKey, item: FunnelDetailItem) => {
      if (!det[channel]) det[channel] = blankDetails();
      det[channel][metric].push(item);
      det.TOTAL[metric].push(item);
    };
    const buildItem = (dealId: string, dateField: string, status: string | null = null): FunnelDetailItem => {
      const meta = dealMeta.get(dealId);
      const contact = meta?.contact_id ? contactInfo.get(meta.contact_id) : null;
      return {
        id: dealId,
        dealId,
        name: contact?.name || null,
        email: meta?.email || contact?.email || null,
        phone: contact?.phone || null,
        date: dateField,
        channel: meta?.channel || 'OUTROS',
        status,
        product: null,
        bruto: null,
        liquido: null,
      };
    };

    // ===== ENTRADAS: deals criados na janela =====
    entradasDeals.forEach((dealId) => {
      const ch = channelOf(dealId);
      get(ch).entradas++;
      const meta = dealMeta.get(dealId);
      pushDet(ch, 'entradas', buildItem(dealId, meta?.created_at || '', null));
    });

    // ===== R1 Agendada / Realizada / No-Show — eventos com scheduled_at na janela =====
    // Espelha o RPC `get_sdr_metrics_from_agenda` (KPI "R1 AGENDADA" do header):
    //   - filtro de squad histórico do SDR + is_partner=false + booked_by não nulo
    //   - dedup por (sdr, deal, dia) com cap de 2 dias por (sdr, deal)
    //   - R1 Realizada/No-Show: 1 por (sdr, deal) com desfecho mais alto
    // Fonte: RPC `get_funnel_r1_attendees_aligned` (mantém deal_id para classificar canal).
    const cohortDealsMap = cohort?.cohortDeals || new Map<string, { anchor: string; followupEnd: string }>();
    const r1AlignedList = cohort?.r1Aligned || [];
    type AlignedAgg = { days: Array<{ day: string; sched: string; isRealized: boolean; isNoShow: boolean }> };
    const sdrDealMap = new Map<string, AlignedAgg>(); // key: sdr|deal
    r1AlignedList.forEach((r) => {
      // Restringe aos SDRs ativos do squad (mesmo recorte de enrichedKPIs do header)
      if (allowedSdrEmails.size > 0 && !allowedSdrEmails.has((r.sdrEmail || '').toLowerCase())) return;
      const key = `${r.sdrEmail}|${r.dealId}`;
      const cur = sdrDealMap.get(key) || { days: [] };
      cur.days.push({ day: r.meetingDay, sched: r.scheduledAt, isRealized: !!r.isRealized, isNoShow: !!r.isNoShow });
      sdrDealMap.set(key, cur);
    });
    sdrDealMap.forEach((agg, key) => {
      const dealId = key.split('|')[1];
      const ch = channelOf(dealId);
      const slot = get(ch);
      // Cap de 2 dias por (sdr, deal) — espelha LEAST(COUNT(DISTINCT meeting_day), 2)
      const sortedDays = agg.days
        .slice()
        .sort((a, b) => new Date(a.sched).getTime() - new Date(b.sched).getTime())
        .slice(0, 2);
      sortedDays.forEach(({ sched, isRealized, isNoShow }) => {
        slot.r1Agendada++;
        pushDet(ch, 'r1Agendada', buildItem(dealId, sched, null));
        if (isRealized) {
          slot.r1Realizada++;
          pushDet(ch, 'r1Realizada', buildItem(dealId, sched, 'completed'));
        }
        if (isNoShow) {
          slot.noShow++;
          pushDet(ch, 'noShow', buildItem(dealId, sched, 'no_show'));
        }
      });
    });

    // Contrato Pago — alinhado ao KPI "CONTRATOS" do header (1 por sdr+deal,
    // is_partner=false, SDR ativo do squad). Independe da R1 estar na janela.
    const seenSdrDeal = new Set<string>();
    contratoPagoAligned.forEach(({ dealId, sdrId }) => {
      const key = `${sdrId}|${dealId}`;
      if (seenSdrDeal.has(key)) return;
      seenSdrDeal.add(key);
      const ch = channelOf(dealId);
      get(ch).contratoPago++;
      const cd = cohortDealsMap.get(dealId);
      pushDet(ch, 'contratoPago', buildItem(dealId, cd?.anchor || '', 'contract_paid'));
    });

    // R2 / Aprovados / Reprovados / Próxima Semana — eventos da janela
    const seenCarrinho = new Set<string>();
    carrinhoRows.forEach(c => {
      if (!c.deal_id || seenCarrinho.has(c.deal_id)) return;
      seenCarrinho.add(c.deal_id);
      const ch = channelOf(c.deal_id);
      const slot = get(ch);
      const attStatus = (c.attendee_status || '').toLowerCase();
      const meetingStatus = (c.meeting_status || '').toLowerCase();
      const isCancelled = attStatus === 'cancelled' || attStatus === 'rescheduled';
      const status = (c.r2_status_name || '').toLowerCase();
      const r2Item: FunnelDetailItem = {
        id: c.deal_id,
        dealId: c.deal_id,
        name: dealMeta.get(c.deal_id)?.contact_id ? (contactInfo.get(dealMeta.get(c.deal_id)!.contact_id!)?.name || null) : null,
        email: c.contact_email || dealMeta.get(c.deal_id)?.email || null,
        phone: c.contact_phone || c.attendee_phone || null,
        date: '',
        channel: ch,
        status: c.r2_status_name || c.attendee_status,
        product: null, bruto: null, liquido: null,
      };
      if (!isCancelled) { slot.r2Agendada++; pushDet(ch, 'r2Agendada', r2Item); }
      if (
        attStatus === 'completed' || attStatus === 'contract_paid' || attStatus === 'refunded' ||
        meetingStatus === 'completed'
      ) { slot.r2Realizada++; pushDet(ch, 'r2Realizada', r2Item); }
      if (status.includes('aprovado') || status.includes('approved')) {
        slot.aprovados++; pushDet(ch, 'aprovados', r2Item);
      } else if (status.includes('próxima') || status.includes('proxima') || status.includes('next')) {
        slot.proximaSemana++; pushDet(ch, 'proximaSemana', r2Item);
      } else if (status.includes('reembolso') || status.includes('desistente') || status.includes('reprovado') || status.includes('cancelado')) {
        slot.reprovados++; pushDet(ch, 'reprovados', r2Item);
      }
    });

    // Venda Final + Faturamento — vendas com sale_date na janela
    vendasFinal.forEach((v: any) => {
      const ch = emailToChannel.get(v.email) || extraEmailChannels.get(v.email) || 'OUTROS';
      const slot = get(ch);
      slot.vendaFinal++;
      slot.faturamentoBruto += v.bruto || 0;
      slot.faturamentoLiquido += v.liquido || 0;
      const vendaItem: FunnelDetailItem = {
        id: v.email,
        dealId: null,
        name: null,
        email: v.email,
        phone: v.phone || null,
        date: v.saleDate ? new Date(v.saleDate).toISOString() : '',
        channel: ch,
        status: 'completed',
        product: v.product || null,
        bruto: v.bruto || 0,
        liquido: v.liquido || 0,
      };
      pushDet(ch, 'vendaFinal', vendaItem);
      pushDet(ch, 'faturamentoBruto', vendaItem);
      pushDet(ch, 'faturamentoLiquido', vendaItem);
    });

    const finalRows: ChannelFunnelRow[] = Array.from(map.entries()).map(([channel, v]) => ({
      channel,
      channelLabel: displayChannelLabel(channel),
      ...v,
      r1AgToReal: v.r1Agendada > 0 ? (v.r1Realizada / v.r1Agendada) * 100 : 0,
      r1RealToContrato: v.r1Realizada > 0 ? (v.contratoPago / v.r1Realizada) * 100 : 0,
      aprovadoToVenda: v.aprovados > 0 ? (v.vendaFinal / v.aprovados) * 100 : 0,
      entradaToVenda: v.entradas > 0 ? (v.vendaFinal / v.entradas) * 100 : 0,
      taxaNoShow: v.r1Agendada > 0 ? (v.noShow / v.r1Agendada) * 100 : 0,
    })).sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);

    const tot = finalRows.reduce((acc, r) => ({
      entradas: acc.entradas + r.entradas,
      r1Agendada: acc.r1Agendada + r.r1Agendada,
      r1Realizada: acc.r1Realizada + r.r1Realizada,
      noShow: acc.noShow + r.noShow,
      contratoPago: acc.contratoPago + r.contratoPago,
      r2Agendada: acc.r2Agendada + r.r2Agendada,
      r2Realizada: acc.r2Realizada + r.r2Realizada,
      aprovados: acc.aprovados + r.aprovados,
      reprovados: acc.reprovados + r.reprovados,
      proximaSemana: acc.proximaSemana + r.proximaSemana,
      vendaFinal: acc.vendaFinal + r.vendaFinal,
      faturamentoBruto: acc.faturamentoBruto + r.faturamentoBruto,
      faturamentoLiquido: acc.faturamentoLiquido + r.faturamentoLiquido,
    }), {
      entradas: 0, r1Agendada: 0, r1Realizada: 0, noShow: 0, contratoPago: 0,
      r2Agendada: 0, r2Realizada: 0, aprovados: 0, reprovados: 0,
      proximaSemana: 0, vendaFinal: 0, faturamentoBruto: 0, faturamentoLiquido: 0,
    });

    return { rows: finalRows, totals: tot, details: det };
  }, [cohort, carrinhoRows, vendasFinal, dealMeta, emailToChannel, extraEmailChannels, contactInfo, entradasDeals, allowedSdrEmails, contratoPagoAligned]);

  return {
    rows,
    totals,
    details,
    isLoading: loadingCohort || loadingCarrinho || loadingVendas || loadingMeta || loadingEntradas || loadingContratos,
  };
}
