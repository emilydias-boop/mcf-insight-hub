import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useAcquisitionReport } from './useAcquisitionReport';
import { getCartWeekStart, getCartWeekEnd } from '@/lib/carrinhoWeekBoundaries';
import { addWeeks, format } from 'date-fns';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';

/**
 * Funil completo por canal — fonte alinhada ao Painel Comercial.
 *
 * As métricas R1 (Agendada / Realizada / No-Show / Contrato Pago) e Entradas vêm da
 * RPC `get_channel_funnel_metrics`, que replica a lógica de `get_sdr_metrics_from_agenda`
 * (Painel Comercial) — apenas agregando por canal em vez de por SDR.
 *
 * R2 (Aprovado/Reprovado/Próx. Semana) continua vindo da RPC do Carrinho.
 * Faturamento (Venda Final/Bruto/Líquido) continua vindo de `useAcquisitionReport`.
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

interface ChannelMetricsResponse {
  channels: Array<{
    channel: string;
    entradas: number;
    r1_agendada: number;
    r1_realizada: number;
    no_shows: number;
    contratos: number;
  }>;
}

interface CarrinhoFunnelRow {
  deal_id: string | null;
  r2_status_name: string | null;
}

function normalizeFunnelChannel(raw: string): string {
  if (!raw) return 'OUTROS';
  const r = String(raw).toUpperCase();
  if (r.includes('A010')) return 'A010';
  if (r === 'LIVE' || r === 'ANAMNESE' || r === 'ANAMNESE-INSTA' || r === 'LANÇAMENTO' || r === 'LANCAMENTO') {
    return 'ANAMNESE';
  }
  return 'OUTROS';
}

// helper: últimos 9 dígitos do telefone para matching
const phoneSuffix = (phone: string | null | undefined): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};

// Produtos que contam como Venda Final de Parceria.
// Reaproveita a whitelist do relatório de Faturamento + A005 (P2 = pacote de
// parceria, com 35 ocorrências/mês).
const PARCERIA_VENDA_PRODUCTS = new Set<string>([
  ...ALLOWED_BILLING_PRODUCTS,
  'A005 - MCF P2',
]);

interface ParceriaConversion {
  id: string;
  email: string;
  phone: string;
  product_name: string;
  bruto: number;     // reference_price configurado
  liquido: number;   // valor pago (product_price do Hubla)
  channel: string;   // 'A010' | 'ANAMNESE' | 'OUTROS'
}

export function useChannelFunnelReport(dateRange: DateRange | undefined, bu?: BusinessUnit) {
  // acq mantido apenas para compatibilidade (loading state); a fonte real de
  // Venda Final agora é uma query direta abaixo.
  const acq = useAcquisitionReport(dateRange, bu);

  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
  const endDate = dateRange?.to
    ? format(dateRange.to, 'yyyy-MM-dd')
    : (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null);

  // 1. Métricas R1 + Entradas — mesma fonte do Painel Comercial
  const { data: channelMetrics, isLoading: loadingMetrics } = useQuery<ChannelMetricsResponse>({
    queryKey: ['channel-funnel-metrics', startDate, endDate, bu],
    queryFn: async () => {
      if (!startDate || !endDate) return { channels: [] };
      const { data, error } = await supabase.rpc('get_channel_funnel_metrics', {
        start_date: startDate,
        end_date: endDate,
        bu_filter: bu || null,
      });
      if (error) {
        console.error('[useChannelFunnelReport] RPC error', error);
        throw error;
      }
      return (data as unknown as ChannelMetricsResponse) || { channels: [] };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 60_000,
  });

  // 2. Carrinho (Aprovado/Reprovado/Próxima semana) por semanas tocadas pelo período
  const weeksInRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [] as Array<{ start: Date; end: Date }>;
    const out: Array<{ start: Date; end: Date }> = [];
    let cursor = getCartWeekStart(dateRange.from);
    const last = getCartWeekStart(dateRange.to);
    let safety = 0;
    while (cursor.getTime() <= last.getTime() && safety < 60) {
      out.push({ start: cursor, end: getCartWeekEnd(cursor) });
      cursor = getCartWeekStart(addWeeks(cursor, 1));
      safety++;
    }
    return out;
  }, [dateRange]);

  const carrinhoKey = weeksInRange.map(w => format(w.start, 'yyyy-MM-dd')).join(',');
  const { data: carrinhoRows = [], isLoading: loadingCarrinho } = useQuery<CarrinhoFunnelRow[]>({
    queryKey: ['funnel-carrinho', carrinhoKey],
    queryFn: async () => {
      if (weeksInRange.length === 0) return [];
      const all: CarrinhoFunnelRow[] = [];
      for (const w of weeksInRange) {
        const { data, error } = await supabase.rpc('get_carrinho_r2_attendees', {
          p_week_start: format(w.start, 'yyyy-MM-dd'),
          p_window_start: new Date(w.start).toISOString(),
          p_window_end: new Date(new Date(w.end).setHours(23, 59, 59, 999)).toISOString(),
          p_apply_contract_cutoff: false,
          p_previous_cutoff: new Date(w.start).toISOString(),
        });
        if (error) {
          console.warn('[funnel] carrinho RPC error', error);
          continue;
        }
        (data || []).forEach((r: any) => all.push({
          deal_id: r.deal_id,
          r2_status_name: r.r2_status_name,
        }));
      }
      return all;
    },
    enabled: weeksInRange.length > 0,
    staleTime: 60_000,
  });

  // 2b. IDs da PRIMEIRA compra de parceria por email no período.
  // Busca DIRETA em hubla_transactions (sem passar por acq.classified).
  //
  // Filtros aplicados:
  //  - product_name na whitelist PARCERIA_VENDA_PRODUCTS (A001/A002/A003/A004/
  //    A005/A009 completo). EXCLUI A000-Contrato (parcela mensal), renovações
  //    (A006, A009-Renovação), Club isolado e produtos auxiliares.
  //  - sale_status = 'completed', sources hubla/kiwify/manual/mcfpay (exclui
  //    'make' que duplica).
  //  - "Primeira conversão" = email NUNCA comprou parceria antes (lookback
  //    12 meses). Recompras/upsells de quem já era parceiro NÃO contam.
  //
  // Bruto = reference_price configurado em product_configurations.
  // Líquido = product_price (o que efetivamente entrou via Hubla).
  // Canal = via R1 attendees (email/telefone). Quem foi reconhecido em R1
  // entra em A010/ANAMNESE conforme tags ou pipeline; quem não passou por R1
  // cai em OUTROS.
  const { data: refPrices = new Map<string, number>() } = useQuery<Map<string, number>>({
    queryKey: ['funnel-ref-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_configurations')
        .select('product_name, reference_price')
        .in('product_category', ['incorporador', 'parceria'])
        .eq('is_active', true);
      if (error) {
        console.error('[useChannelFunnelReport] ref prices error', error);
        return new Map();
      }
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => {
        m.set(r.product_name, Number(r.reference_price) || 0);
      });
      return m;
    },
    staleTime: 5 * 60_000,
  });

  const { data: parceriaConversions = [], isLoading: loadingFirstParceria } = useQuery<ParceriaConversion[]>({
    queryKey: ['funnel-parceria-conversions-v3', startDate, endDate, refPrices.size],
    queryFn: async () => {
      if (!startDate || !endDate) return [];

      // 1. Todas as transações do período da whitelist (para deduplicar
      //    primeira por email).
      const { data: periodTx, error: periodErr } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, product_name, product_price, sale_date')
        .in('product_category', ['incorporador', 'parceria'])
        .eq('sale_status', 'completed')
        .in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
        .gte('sale_date', `${startDate}T00:00:00-03:00`)
        .lte('sale_date', `${endDate}T23:59:59-03:00`)
        .order('sale_date', { ascending: true })
        .limit(5000);
      if (periodErr) {
        console.error('[useChannelFunnelReport] period query error', periodErr);
        throw periodErr;
      }

      // Filtra pela whitelist de produtos válidos (exclui A000/Renovação/etc)
      const validTx = (periodTx || []).filter((tx: any) =>
        PARCERIA_VENDA_PRODUCTS.has(tx.product_name)
      );

      // 2. Quem JÁ era parceiro antes do período (lookback 12 meses) — excluir
      //    Aqui mantemos o filtro AMPLO (qualquer compra de parceria/incorporador)
      //    para garantir que recompras de quem já era parceiro fiquem fora,
      //    mesmo que naquela época tenha comprado um produto fora da whitelist.
      const lookbackStart = new Date(`${startDate}T00:00:00-03:00`);
      lookbackStart.setMonth(lookbackStart.getMonth() - 12);
      const { data: priorBuyers, error: priorErr } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .in('product_category', ['incorporador', 'parceria'])
        .eq('sale_status', 'completed')
        .in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
        .gte('sale_date', lookbackStart.toISOString())
        .lt('sale_date', `${startDate}T00:00:00-03:00`)
        .limit(20000);
      if (priorErr) {
        console.error('[useChannelFunnelReport] prior buyers query error', priorErr);
        throw priorErr;
      }
      const priorEmails = new Set<string>(
        (priorBuyers || [])
          .map((r: any) => (r.customer_email || '').toLowerCase().trim())
          .filter(Boolean)
      );

      // 3. Reduzir a uma única conversão por email (a primeira no período) e
      //    excluir quem já era parceiro antes.
      const seen = new Set<string>();
      type Pending = {
        id: string;
        email: string;
        phone: string;
        product_name: string;
        bruto: number;
        liquido: number;
      };
      const pending: Pending[] = [];
      for (const tx of validTx as any[]) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (!email || seen.has(email) || priorEmails.has(email)) continue;
        seen.add(email);
        const liquido = Number(tx.product_price) || 0;
        // Bruto = reference_price configurado. Fallback para o próprio Hubla
        // se não houver configuração (não deve acontecer, mas evita zerar).
        const bruto = refPrices.get(tx.product_name) || liquido;
        pending.push({
          id: tx.id,
          email,
          phone: phoneSuffix(tx.customer_phone),
          product_name: tx.product_name,
          bruto,
          liquido,
        });
      }

      if (pending.length === 0) return [];

      // 4. Buscar R1 attendees nos últimos ~90 dias para determinar o canal
      //    de cada conversão (A010 / ANAMNESE / OUTROS).
      const r1Lookback = new Date(`${startDate}T00:00:00-03:00`);
      r1Lookback.setDate(r1Lookback.getDate() - 90);
      const r1End = new Date(`${endDate}T23:59:59-03:00`);

      type AttRow = {
        attendee_phone: string | null;
        crm_deals: {
          tags: any[] | null;
          origin_id: string | null;
          crm_contacts: { email: string | null; phone: string | null } | null;
        } | null;
      };
      const allAtt: AttRow[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore && offset < 10000) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            attendee_phone,
            meeting_slots!inner(scheduled_at, meeting_type),
            crm_deals!deal_id(tags, origin_id, crm_contacts!contact_id(email, phone))
          `)
          .eq('meeting_slots.meeting_type', 'r1')
          .gte('meeting_slots.scheduled_at', r1Lookback.toISOString())
          .lte('meeting_slots.scheduled_at', r1End.toISOString())
          .range(offset, offset + pageSize - 1);
        if (error) {
          console.warn('[useChannelFunnelReport] r1 attendees error', error);
          break;
        }
        const batch = (data || []) as unknown as AttRow[];
        allAtt.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }

      // 5. Buscar nomes de pipelines/origens para fallback de classificação
      const originIds = new Set<string>();
      allAtt.forEach(a => {
        if (a.crm_deals?.origin_id) originIds.add(a.crm_deals.origin_id);
      });
      let originNameById = new Map<string, string>();
      if (originIds.size > 0) {
        const { data: origins } = await supabase
          .from('crm_origins')
          .select('id, name')
          .in('id', Array.from(originIds));
        (origins || []).forEach((o: any) => originNameById.set(o.id, (o.name || '').toUpperCase()));
      }

      // 6. Indexar attendees por email e por sufixo de telefone, guardando
      //    tags + nome da origem para classificação.
      type AttIdx = { tags: string[]; originName: string };
      const emailToAtt = new Map<string, AttIdx>();
      const phoneToAtt = new Map<string, AttIdx>();
      for (const a of allAtt) {
        const tags: string[] = (a.crm_deals?.tags as any[] || []).map((t: any) => {
          if (typeof t === 'string') {
            if (t.startsWith('{')) {
              try { return (JSON.parse(t)?.name || t).toUpperCase(); } catch { return t.toUpperCase(); }
            }
            return t.toUpperCase();
          }
          return (t?.name || '').toUpperCase();
        });
        const originName = a.crm_deals?.origin_id
          ? (originNameById.get(a.crm_deals.origin_id) || '')
          : '';
        const idx: AttIdx = { tags, originName };
        const email = (a.crm_deals?.crm_contacts?.email || '').toLowerCase().trim();
        if (email) emailToAtt.set(email, idx);
        const cPhone = phoneSuffix(a.crm_deals?.crm_contacts?.phone);
        if (cPhone.length >= 8) phoneToAtt.set(cPhone, idx);
        const aPhone = phoneSuffix(a.attendee_phone);
        if (aPhone.length >= 8 && aPhone !== cPhone) phoneToAtt.set(aPhone, idx);
      }

      // 7. Classificação:
      //  a) Tags claras → A010 / ANAMNESE
      //  b) Origem (pipeline) → A010 / ANAMNESE
      //  c) Tinha R1 mas sem sinal claro → ANAMNESE (passou pelo funil)
      //  d) Sem R1 attendee → OUTROS (compra direta)
      const classifyAtt = (idx: AttIdx): string => {
        const { tags, originName } = idx;
        if (tags.some(t => t.includes('A010'))) return 'A010';
        if (tags.some(t => t.includes('ANAMNESE') || t.includes('LIVE') || t.includes('LANÇ') || t.includes('LANC'))) return 'ANAMNESE';
        if (originName.includes('A010')) return 'A010';
        if (originName.includes('ANAMNESE') || originName.includes('LIVE') || originName.includes('LANÇ') || originName.includes('LANC')) return 'ANAMNESE';
        // Passou por R1, foi reconhecido, mas sem sinal explícito de canal:
        // assume ANAMNESE (a maior parte dos R1 sem tag vem desse fluxo).
        return 'ANAMNESE';
      };

      const result: ParceriaConversion[] = pending.map(p => {
        const att = emailToAtt.get(p.email) || (p.phone.length >= 8 ? phoneToAtt.get(p.phone) : undefined);
        const channel = att ? classifyAtt(att) : 'OUTROS';
        return { ...p, channel };
      });
      return result;
    },
    enabled: !!startDate && !!endDate && refPrices.size > 0,
    staleTime: 60_000,
  });

  // 3. Agregação por canal (3 buckets fixos)
  const { rows, totals } = useMemo(() => {
    const FUNNEL_CHANNELS = ['A010', 'ANAMNESE', 'OUTROS'];
    const blank = (): Omit<ChannelFunnelRow, 'channel' | 'channelLabel' | 'r1AgToReal' | 'r1RealToContrato' | 'aprovadoToVenda' | 'entradaToVenda' | 'taxaNoShow'> => ({
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

    // Métricas R1 vindas da RPC alinhada ao Painel
    (channelMetrics?.channels || []).forEach(c => {
      const slot = get(c.channel);
      slot.entradas = c.entradas || 0;
      slot.r1Agendada = c.r1_agendada || 0;
      slot.r1Realizada = c.r1_realizada || 0;
      slot.noShow = c.no_shows || 0;
      slot.contratoPago = c.contratos || 0;
    });

    // Carrinho — Aprovado / Reprovado / Próxima semana (deduplicado por deal)
    // Como a RPC nova não retorna deal_id por canal, contamos no balde "OUTROS" os
    // sem mapeamento; o Carrinho é uma visão complementar e o número agregado é o que importa.
    const seenCarrinho = new Set<string>();
    carrinhoRows.forEach(c => {
      if (!c.deal_id || seenCarrinho.has(c.deal_id)) return;
      seenCarrinho.add(c.deal_id);
      const slot = get('OUTROS'); // sem deal->channel map aqui; soma vai para Total
      const status = (c.r2_status_name || '').toLowerCase();
      if (status.includes('aprovado') || status.includes('approved')) slot.aprovados++;
      else if (status.includes('próxima') || status.includes('proxima') || status.includes('next')) slot.proximaSemana++;
      else if (status.includes('reembolso') || status.includes('desistente') || status.includes('reprovado') || status.includes('cancelado')) slot.reprovados++;
    });

    // Venda Final + Faturamento — primeira conversão em Parceria por cliente
    // (email) no período, da whitelist de produtos válidos.
    //
    // Bruto  = reference_price configurado em product_configurations
    // Líquido = valor pago via Hubla (product_price)
    //
    // Canal:
    //   - Tem R1 attendee + tag/origem A010 → A010
    //   - Tem R1 attendee + tag/origem ANAMNESE/LIVE/LANÇ → ANAMNESE
    //   - Tem R1 attendee mas sem sinal claro → ANAMNESE (passou por R1)
    //   - Não tem R1 attendee → OUTROS (compra direta)
    parceriaConversions.forEach(({ channel, bruto, liquido }) => {
      const ch = normalizeFunnelChannel(channel);
      const slot = get(ch);
      slot.vendaFinal++;
      slot.faturamentoBruto += bruto || 0;
      slot.faturamentoLiquido += liquido || 0;
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

    return { rows: finalRows, totals: tot };
  }, [channelMetrics, carrinhoRows, parceriaConversions]);

  return {
    rows,
    totals,
    isLoading: loadingMetrics || loadingCarrinho || loadingFirstParceria || acq.isLoading,
  };
}