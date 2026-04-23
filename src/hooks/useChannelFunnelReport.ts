import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { classifyChannel } from '@/lib/channelClassifier';
import { useAcquisitionReport } from './useAcquisitionReport';
import { useBUOriginIds } from './useBUPipelineMap';
import { getCartWeekStart, getCartWeekEnd } from '@/lib/carrinhoWeekBoundaries';
import { addWeeks, format } from 'date-fns';

/**
 * Funil completo por canal:
 * Entradas (deals criados no período) → R1 Agendada → R1 Realizada → Contrato Pago
 * → R2 Agendada → R2 Realizada → Aprovado / Reprovado / Próxima Semana → Venda Final / Faturamento
 *
 * Reutiliza `useAcquisitionReport` para obter `classified` (transações já mapeadas a canal/closer/sdr)
 * e busca em paralelo os deals criados no período + attendees R1/R2 + dados de Carrinho da(s) safra(s).
 */

const CHANNEL_LABELS: Record<string, string> = {
  LIVE: 'LIVE',
  OUTROS: 'OUTROS / SEM-CLASSIFICAÇÃO',
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
  r1AgToReal: number; // R1 real / R1 ag
  r1RealToContrato: number; // contrato / R1 real
  aprovadoToVenda: number; // venda final / aprovados
  entradaToVenda: number; // venda final / entradas
  taxaNoShow: number; // noShow / r1Agendada
}

interface DealRow {
  id: string;
  tags: any[] | null;
  origin_name: string | null;
  lead_channel: string | null;
  data_source: string | null;
  created_at: string;
}

interface AttendeeFunnelRow {
  id: string;
  deal_id: string | null;
  status: string | null;
  meeting_slots: { meeting_type: string | null; scheduled_at: string | null; status: string | null } | null;
}

interface CarrinhoFunnelRow {
  deal_id: string | null;
  r2_status_name: string | null;
}

function classifyDeal(d: DealRow): string {
  const rawTags: string[] = Array.isArray(d.tags) ? d.tags as any[] : [];
  const hasA010 = rawTags.some(t => {
    const s = typeof t === 'string' ? t : (t as any)?.name || '';
    return String(s).toUpperCase().includes('A010');
  });
  return classifyChannel({
    tags: rawTags,
    originName: d.origin_name,
    leadChannel: d.lead_channel,
    dataSource: d.data_source,
    hasA010,
  });
}

/** Normaliza canais de deal (que podem incluir BIO-INSTAGRAM, LEAD-FORM, etc.) para os 6 canais oficiais do funil. */
function normalizeFunnelChannel(raw: string): string {
  if (!raw) return 'OUTROS';
  if (raw === 'A010 (MAKE)') return 'A010';
  if (raw === 'LIVE') return 'LIVE';
  if (raw === 'A010' || raw === 'ANAMNESE' || raw === 'ANAMNESE-INSTA' || raw === 'OUTSIDE' || raw === 'LANÇAMENTO') return raw;
  // Tudo o que não é canal oficial (BIO-INSTAGRAM, LEAD-FORM, HUBLA, BASE CLINT, CSV, WEBHOOK, etc.) cai em OUTROS
  return 'OUTROS';
}

export function useChannelFunnelReport(dateRange: DateRange | undefined, bu?: BusinessUnit) {
  const acq = useAcquisitionReport(dateRange, bu);
  const { data: buOriginIds = [] } = useBUOriginIds(bu ?? null);

  const startISO = dateRange?.from ? new Date(dateRange.from).toISOString() : null;
  const endISO = dateRange?.to
    ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
    : (dateRange?.from ? new Date(new Date(dateRange.from).setHours(23, 59, 59, 999)).toISOString() : null);

  // 1. Deals criados no período (para Entradas e classificação)
  const { data: deals = [], isLoading: loadingDeals } = useQuery<DealRow[]>({
    queryKey: ['funnel-deals', startISO, endISO, bu, buOriginIds.join(',')],
    queryFn: async () => {
      if (!startISO || !endISO) return [];
      const all: DealRow[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        let q = supabase
          .from('crm_deals')
          .select('id, tags, custom_fields, data_source, created_at, crm_origins(name)')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .range(offset, offset + pageSize - 1);
        if (buOriginIds && buOriginIds.length > 0) {
          q = q.in('origin_id', buOriginIds);
        }
        const { data, error } = await q;
        if (error) throw error;
        const batch = ((data || []) as any[]).map((r: any) => ({
          id: r.id,
          tags: r.tags,
          origin_name: r.crm_origins?.name ?? null,
          lead_channel: r.custom_fields?.lead_channel ?? null,
          data_source: r.data_source,
          created_at: r.created_at,
        })) as DealRow[];
        all.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    enabled: !!startISO && !!endISO,
    staleTime: 60_000,
  });

  const dealChannelMap = useMemo(() => {
    const m = new Map<string, string>();
    deals.forEach(d => m.set(d.id, normalizeFunnelChannel(classifyDeal(d))));
    return m;
  }, [deals]);

  // 2. R1 + R2 attendees do período (para qualquer deal)
  const { data: attendees = [], isLoading: loadingAtt } = useQuery<AttendeeFunnelRow[]>({
    queryKey: ['funnel-attendees', startISO, endISO],
    queryFn: async () => {
      if (!startISO || !endISO) return [];
      const all: AttendeeFunnelRow[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select('id, deal_id, status, meeting_slots!inner(meeting_type, scheduled_at, status)')
          .in('meeting_slots.meeting_type', ['r1', 'r2'])
          .gte('meeting_slots.scheduled_at', startISO)
          .lte('meeting_slots.scheduled_at', endISO)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as unknown as AttendeeFunnelRow[];
        all.push(...batch);
        hasMore = batch.length >= pageSize;
        offset += pageSize;
      }
      return all;
    },
    enabled: !!startISO && !!endISO,
    staleTime: 60_000,
  });

  // 3. Carrinho (Aprovado/Reprovado/Próxima semana) — para todas as semanas tocadas pelo período
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

  // 4. Agregação por canal
  const { rows, totals } = useMemo(() => {
    const FUNNEL_CHANNELS = ['A010', 'ANAMNESE', 'ANAMNESE-INSTA', 'LIVE', 'OUTROS', 'OUTSIDE', 'LANÇAMENTO'];
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

    // Entradas: 1 por deal classificado
    deals.forEach(d => {
      const ch = dealChannelMap.get(d.id) || 'OUTROS';
      get(ch).entradas++;
    });

    // R1/R2 — deduplicação por deal (Realizada vence No-show; até 2 dias contam para agendada)
    const REALIZED = new Set(['completed', 'contract_paid', 'refunded']);
    const dedup = (type: 'r1' | 'r2') => {
      const dealMap = new Map<string, { days: Set<string>; realized: boolean; contractPaid: boolean; noShow: boolean }>();
      const noDealCount = { agendada: 0, realizada: 0, contractPaid: 0, noShow: 0 };
      attendees.forEach(a => {
        if (a.meeting_slots?.meeting_type !== type) return;
        const status = (a.status || a.meeting_slots?.status || '').toLowerCase();
        if (status === 'cancelled') return;
        const sched = a.meeting_slots?.scheduled_at;
        if (!sched) return;
        const day = sched.slice(0, 10);

        if (!a.deal_id) {
          noDealCount.agendada++;
          if (REALIZED.has(status)) noDealCount.realizada++;
          if (status === 'contract_paid') noDealCount.contractPaid++;
          if (status === 'no_show') noDealCount.noShow++;
          return;
        }
        const cur = dealMap.get(a.deal_id) || { days: new Set<string>(), realized: false, contractPaid: false, noShow: false };
        cur.days.add(day);
        if (REALIZED.has(status)) cur.realized = true;
        if (status === 'contract_paid') cur.contractPaid = true;
        if (status === 'no_show') cur.noShow = true;
        dealMap.set(a.deal_id, cur);
      });
      return { dealMap, noDealCount };
    };

    const r1 = dedup('r1');
    const r2 = dedup('r2');

    r1.dealMap.forEach((v, dealId) => {
      const ch = dealChannelMap.get(dealId) || 'OUTROS';
      const slot = get(ch);
      // Conta deals únicos — reagendamentos não inflam o denominador
      slot.r1Agendada += 1;
      if (v.realized) slot.r1Realizada++;
      if (v.noShow) slot.noShow++;
      if (v.contractPaid) slot.contratoPago++;
    });
    r2.dealMap.forEach((v, dealId) => {
      const ch = dealChannelMap.get(dealId) || 'OUTROS';
      const slot = get(ch);
      slot.r2Agendada += 1;
      if (v.realized) slot.r2Realizada++;
    });
    // Sem deal → empilha em "OUTROS" como fallback
    if (r1.noDealCount.agendada > 0) {
      const slot = get('OUTROS');
      slot.r1Agendada += r1.noDealCount.agendada;
      slot.r1Realizada += r1.noDealCount.realizada;
      slot.noShow += r1.noDealCount.noShow;
      slot.contratoPago += r1.noDealCount.contractPaid;
    }
    if (r2.noDealCount.agendada > 0) {
      const slot = get('OUTROS');
      slot.r2Agendada += r2.noDealCount.agendada;
      slot.r2Realizada += r2.noDealCount.realizada;
    }

    // Carrinho — Aprovado / Reprovado / Próxima semana (por deal)
    const seenCarrinho = new Set<string>();
    carrinhoRows.forEach(c => {
      if (!c.deal_id || seenCarrinho.has(c.deal_id)) return;
      seenCarrinho.add(c.deal_id);
      const ch = dealChannelMap.get(c.deal_id) || 'OUTROS';
      const slot = get(ch);
      const status = (c.r2_status_name || '').toLowerCase();
      if (status.includes('aprovado') || status.includes('approved')) slot.aprovados++;
      else if (status.includes('próxima') || status.includes('proxima') || status.includes('next')) slot.proximaSemana++;
      else if (status.includes('reembolso') || status.includes('desistente') || status.includes('reprovado') || status.includes('cancelado')) slot.reprovados++;
    });

    // Venda Final + Faturamento — vem do useAcquisitionReport.classified (transações pagas)
    acq.classified.forEach(({ channel, gross, net }) => {
      const ch = normalizeFunnelChannel(channel);
      const slot = get(ch);
      slot.vendaFinal++;
      slot.faturamentoBruto += gross || 0;
      slot.faturamentoLiquido += net || 0;
    });

    const finalRows: ChannelFunnelRow[] = Array.from(map.entries()).map(([channel, v]) => ({
      channel,
      channelLabel: displayChannelLabel(channel),
      ...v,
      r1AgToReal: v.r1Agendada > 0 ? (v.r1Realizada / v.r1Agendada) * 100 : 0,
      r1RealToContrato: v.r1Realizada > 0 ? (v.contratoPago / v.r1Realizada) * 100 : 0,
      aprovadoToVenda: v.aprovados > 0 ? (v.vendaFinal / v.aprovados) * 100 : 0,
      entradaToVenda: v.entradas > 0 ? (v.vendaFinal / v.entradas) * 100 : 0,
    })).sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);

    const tot = finalRows.reduce((acc, r) => ({
      entradas: acc.entradas + r.entradas,
      r1Agendada: acc.r1Agendada + r.r1Agendada,
      r1Realizada: acc.r1Realizada + r.r1Realizada,
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
      entradas: 0, r1Agendada: 0, r1Realizada: 0, contratoPago: 0,
      r2Agendada: 0, r2Realizada: 0, aprovados: 0, reprovados: 0,
      proximaSemana: 0, vendaFinal: 0, faturamentoBruto: 0, faturamentoLiquido: 0,
    });

    return { rows: finalRows, totals: tot };
  }, [deals, dealChannelMap, attendees, carrinhoRows, acq.classified]);

  return {
    rows,
    totals,
    isLoading: loadingDeals || loadingAtt || loadingCarrinho || acq.isLoading,
  };
}