import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { format } from 'date-fns';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';

/**
 * Funil por Canal — fotografia independente por coluna, dentro da janela exata.
 *
 * Princípio:
 *  - Cada coluna conta DEALS ÚNICOS (ou EMAILS ÚNICOS para venda)
 *    cujo evento principal cai estritamente dentro do intervalo selecionado.
 *  - Sem inflar por reagendamento (1 deal = 1 unidade).
 *  - Sem filtros escondidos de "primeira-compra-da-vida" — venda final inclui
 *    todas as vendas de parceria que entraram no período (incluindo upsells/recompras).
 *  - Classificador de canal único (classifyChannelWith30dRule) aplicado a todos
 *    os deals/contatos da BU — soma por canal sempre fecha.
 */

const CHANNEL_LABELS: Record<string, string> = {
  A010: 'A010',
  ANAMNESE: 'ANAMNESE (Live + Anamnese + Anamnese-Insta)',
  OUTROS: 'OUTROS',
};
export function displayChannelLabel(raw: string): string {
  return CHANNEL_LABELS[raw] || raw;
}

export interface ChannelFunnelRow {
  channel: string;
  channelLabel: string;
  entradas: number;
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
  entradaToVenda: number;
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

function classifyChannelWith30dRule(opts: {
  tags: string[];
  firstA010Purchase: Date | null;
  referenceDate: Date;
}): string {
  const { tags, firstA010Purchase, referenceDate } = opts;
  const isAnamneseTag = (t: string) => {
    if (t.includes('INCOMPLET')) return false;
    return t.includes('ANAMNESE') || t.includes('LIVE') || t.includes('LANÇ') || t.includes('LANC');
  };
  const hasA010Tag = tags.some(t => t.includes('A010'));
  const hasAnamneseSignal = tags.some(isAnamneseTag);
  if (firstA010Purchase) {
    const diffDays = (referenceDate.getTime() - firstA010Purchase.getTime()) / 86_400_000;
    if (diffDays >= -1 && diffDays <= A010_FRESH_WINDOW_DAYS) return 'A010';
    if (diffDays > A010_FRESH_WINDOW_DAYS) return 'ANAMNESE';
  }
  if (hasAnamneseSignal) return 'ANAMNESE';
  if (hasA010Tag) return 'A010';
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

  const windowStartIso = startDate ? new Date(`${startDate}T00:00:00-03:00`).toISOString() : null;
  const windowEndIso = endDate ? new Date(`${endDate}T23:59:59-03:00`).toISOString() : null;

  // ================================================================
  // 1. UNIVERSO DE DEALS — todos os deals da BU envolvidos no funil:
  //    criados na janela OU com R1/R2 na janela OU contrato na janela.
  //    Cada deal recebe seu canal classificado uma única vez.
  // ================================================================
  const { data: dealsByPeriod, isLoading: loadingDeals } = useQuery({
    queryKey: ['funnel-deals-period', startDate, endDate, bu, buOrigins.join(',')],
    queryFn: async (): Promise<{
      dealsCreated: DealMeta[];        // criados na janela (Entradas)
      r1Deals: Map<string, { status: string; contract_paid_at: string | null; scheduled_at: string | null }>; // deal → R1 status
      r1NoShowDeals: Set<string>;
      contratoPagoDeals: Set<string>;
    }> => {
      if (!startDate || !endDate || buOrigins.length === 0) {
        return {
          dealsCreated: [],
          r1Deals: new Map(),
          r1NoShowDeals: new Set(),
          contratoPagoDeals: new Set(),
        };
      }

      // 1a. Deals criados na janela (Entradas) — paginar
      const dealsCreated: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let more = true;
      while (more && from < 20000) {
        const { data, error } = await supabase
          .from('crm_deals')
          .select('id, origin_id, tags, created_at, contact_id, crm_contacts!contact_id(email)')
          .in('origin_id', buOrigins)
          .gte('created_at', windowStartIso!)
          .lte('created_at', windowEndIso!)
          .range(from, from + pageSize - 1);
        if (error) { console.error('[funnel] dealsCreated error', error); break; }
        const batch = data || [];
        dealsCreated.push(...batch);
        more = batch.length >= pageSize;
        from += pageSize;
      }

      // 1b. R1 attendees na janela — agrupado por deal_id, status final
      const r1Attendees: any[] = [];
      from = 0;
      more = true;
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
        if (error) { console.error('[funnel] r1Attendees error', error); break; }
        const batch = data || [];
        r1Attendees.push(...batch);
        more = batch.length >= pageSize;
        from += pageSize;
      }

      const buOriginsSet = new Set(buOrigins);
      const r1Deals = new Map<string, { status: string; contract_paid_at: string | null; scheduled_at: string | null }>();
      const r1NoShowDeals = new Set<string>();
      for (const a of r1Attendees) {
        const dealId = a.deal_id;
        const dealOrigin = a.crm_deals?.origin_id;
        if (!dealId || !buOriginsSet.has(dealOrigin)) continue;
        const slotStatus = (a.meeting_slots?.status || '').toLowerCase();
        const attStatus = (a.status || '').toLowerCase();
        // Skip cancelled/rescheduled
        if (slotStatus === 'cancelled' || slotStatus === 'rescheduled') continue;
        if (attStatus === 'cancelled' || attStatus === 'rescheduled') continue;
        // Determine effective status (priorizar realizada/no_show sobre scheduled)
        let effective = attStatus || slotStatus || 'scheduled';
        if (slotStatus === 'completed' || attStatus === 'completed') effective = 'completed';
        else if (slotStatus === 'no_show' || attStatus === 'no_show') effective = 'no_show';
        const scheduledAt = a.meeting_slots?.scheduled_at || null;
        const existing = r1Deals.get(dealId);
        // Mantém o "melhor" status: completed > no_show > scheduled
        const rank = (s: string) => s === 'completed' ? 3 : s === 'no_show' ? 2 : 1;
        if (!existing || rank(effective) > rank(existing.status)) {
          r1Deals.set(dealId, { status: effective, contract_paid_at: a.contract_paid_at, scheduled_at: scheduledAt });
        } else if (!existing.contract_paid_at && a.contract_paid_at) {
          existing.contract_paid_at = a.contract_paid_at;
        }
        if (effective === 'no_show') r1NoShowDeals.add(dealId);
      }

      // 1c. Contrato Pago: contract_paid_at na janela (sobre attendees R1 da BU)
      const contratoPagoDeals = new Set<string>();
      const cpAttendees: any[] = [];
      from = 0;
      more = true;
      while (more && from < 10000) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id, contract_paid_at,
            crm_deals!deal_id(origin_id)
          `)
          .gte('contract_paid_at', windowStartIso!)
          .lte('contract_paid_at', windowEndIso!)
          .range(from, from + pageSize - 1);
        if (error) { console.error('[funnel] contratoPago error', error); break; }
        const batch = data || [];
        cpAttendees.push(...batch);
        more = batch.length >= pageSize;
        from += pageSize;
      }
      for (const a of cpAttendees) {
        const dealId = a.deal_id;
        const dealOrigin = a.crm_deals?.origin_id;
        if (!dealId || !buOriginsSet.has(dealOrigin)) continue;
        contratoPagoDeals.add(dealId);
      }

      // dealsCreated normalizados (canal vai ser preenchido depois)
      const dealsNorm: DealMeta[] = dealsCreated.map(d => ({
        id: d.id,
        origin_id: d.origin_id,
        tags: d.tags,
        created_at: d.created_at,
        contact_id: d.contact_id,
        email: (d.crm_contacts?.email || '').toLowerCase().trim() || null,
        channel: 'OUTROS',
      }));

      return { dealsCreated: dealsNorm, r1Deals, r1NoShowDeals, contratoPagoDeals };
    },
    enabled: !!startDate && !!endDate && buOrigins.length > 0,
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
    (dealsByPeriod?.dealsCreated || []).forEach(d => s.add(d.id));
    (dealsByPeriod?.r1Deals || new Map()).forEach((_, id) => s.add(id));
    (dealsByPeriod?.contratoPagoDeals || new Set()).forEach(id => s.add(id));
    carrinhoRows.forEach(c => { if (c.deal_id) s.add(c.deal_id); });
    return Array.from(s);
  }, [dealsByPeriod, carrinhoRows]);

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

      // Buscar primeira compra A010 dos emails (24m lookback) para classificação
      const emails = Array.from(new Set(
        deals.map(d => (d.crm_contacts?.email || '').toLowerCase().trim()).filter(Boolean)
      ));
      const a010Lookback = new Date();
      a010Lookback.setMonth(a010Lookback.getMonth() - 24);
      const firstA010ByEmail = new Map<string, Date>();
      for (let i = 0; i < emails.length; i += 200) {
        const chunk = emails.slice(i, i + 200);
        if (chunk.length === 0) continue;
        const { data: a010Tx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .ilike('product_name', '%A010%')
          .eq('sale_status', 'completed')
          .in('customer_email', chunk)
          .gte('sale_date', a010Lookback.toISOString())
          .order('sale_date', { ascending: true })
          .limit(5000);
        (a010Tx || []).forEach((r: any) => {
          const e = (r.customer_email || '').toLowerCase().trim();
          if (!e) return;
          const d = new Date(r.sale_date);
          if (!firstA010ByEmail.has(e) || d < firstA010ByEmail.get(e)!) {
            firstA010ByEmail.set(e, d);
          }
        });
      }

      for (const d of deals) {
        const email = (d.crm_contacts?.email || '').toLowerCase().trim() || null;
        const tags = parseTags(d.tags);
        const channel = classifyChannelWith30dRule({
          tags,
          firstA010Purchase: email ? (firstA010ByEmail.get(email) || null) : null,
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

      // Lookup A010
      const emails = Array.from(new Set(deals.map(d => d.email).filter(Boolean)));
      const a010Lookback = new Date();
      a010Lookback.setMonth(a010Lookback.getMonth() - 24);
      const firstA010ByEmail = new Map<string, Date>();
      for (let i = 0; i < emails.length; i += 200) {
        const chunk = emails.slice(i, i + 200);
        if (chunk.length === 0) continue;
        const { data: a010Tx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .ilike('product_name', '%A010%')
          .eq('sale_status', 'completed')
          .in('customer_email', chunk)
          .gte('sale_date', a010Lookback.toISOString())
          .order('sale_date', { ascending: true })
          .limit(5000);
        (a010Tx || []).forEach((r: any) => {
          const e = (r.customer_email || '').toLowerCase().trim();
          if (!e) return;
          const d = new Date(r.sale_date);
          if (!firstA010ByEmail.has(e) || d < firstA010ByEmail.get(e)!) firstA010ByEmail.set(e, d);
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
          firstA010Purchase: firstA010ByEmail.get(e) || null,
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
    const FUNNEL_CHANNELS = ['A010', 'ANAMNESE', 'OUTROS'];
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
      A010: blankDetails(), ANAMNESE: blankDetails(), OUTROS: blankDetails(), TOTAL: blankDetails(),
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

    // Entradas: deals criados na janela
    (dealsByPeriod?.dealsCreated || []).forEach(d => {
      const ch = dealMeta.get(d.id)?.channel || d.channel || 'OUTROS';
      get(ch).entradas++;
      pushDet(ch, 'entradas', buildItem(d.id, d.created_at, null));
    });

    // R1 Agendada / Realizada / No-Show — dedupe por deal
    (dealsByPeriod?.r1Deals || new Map()).forEach((info: any, dealId: string) => {
      const ch = channelOf(dealId);
      const slot = get(ch);
      slot.r1Agendada++;
      const item = buildItem(dealId, info.scheduled_at || '', info.status);
      pushDet(ch, 'r1Agendada', item);
      if (info.status === 'completed') {
        slot.r1Realizada++;
        pushDet(ch, 'r1Realizada', item);
      } else if (info.status === 'no_show') {
        slot.noShow++;
        pushDet(ch, 'noShow', item);
      }
    });

    // Contrato Pago
    (dealsByPeriod?.contratoPagoDeals || new Set()).forEach((dealId: string) => {
      const ch = channelOf(dealId);
      get(ch).contratoPago++;
      // contract_paid_at — pegamos do r1Deals se tiver
      const r1info = (dealsByPeriod?.r1Deals as Map<string, any> | undefined)?.get(dealId);
      pushDet(ch, 'contratoPago', buildItem(dealId, r1info?.contract_paid_at || '', 'contract_paid'));
    });

    // R2 / Aprovados / Reprovados / Próxima Semana — dedupe por deal_id
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

    // Venda Final + Faturamento — TODAS as vendas de parceria do período
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
  }, [dealsByPeriod, carrinhoRows, vendasFinal, dealMeta, emailToChannel, extraEmailChannels, contactInfo]);

  return {
    rows,
    totals,
    details,
    isLoading: loadingDeals || loadingCarrinho || loadingVendas || loadingMeta,
  };
}
