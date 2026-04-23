import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useAcquisitionReport } from './useAcquisitionReport';
import { getCartWeekStart, getCartWeekEnd } from '@/lib/carrinhoWeekBoundaries';
import { addWeeks, format } from 'date-fns';

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

export function useChannelFunnelReport(dateRange: DateRange | undefined, bu?: BusinessUnit) {
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

    // Venda Final + Faturamento — vem do useAcquisitionReport.classified
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
  }, [channelMetrics, carrinhoRows, acq.classified]);

  return {
    rows,
    totals,
    isLoading: loadingMetrics || loadingCarrinho || acq.isLoading,
  };
}