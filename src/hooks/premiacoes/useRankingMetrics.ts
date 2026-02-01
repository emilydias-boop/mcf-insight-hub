import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricaRanking } from '@/types/premiacoes';
import { format, parseISO, eachMonthOfInterval } from 'date-fns';

// Helper: Get array of ano_mes from date range
export function getAnoMesFromPeriodo(dataInicio: string, dataFim: string): string[] {
  const start = parseISO(dataInicio);
  const end = parseISO(dataFim);
  
  const months = eachMonthOfInterval({ start, end });
  return months.map(date => format(date, 'yyyy-MM'));
}

// Fetch payouts with SDR info for the period
export function useRankingPayouts(anoMesList: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['ranking-payouts', anoMesList],
    queryFn: async () => {
      if (anoMesList.length === 0) return [];
      
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, email, name)
        `)
        .in('ano_mes', anoMesList);
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && anoMesList.length > 0,
  });
}

// Fetch KPIs for absolute values
export function useRankingKpis(anoMesList: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['ranking-kpis', anoMesList],
    queryFn: async () => {
      if (anoMesList.length === 0) return [];
      
      const { data, error } = await supabase
        .from('sdr_month_kpi')
        .select('*')
        .in('ano_mes', anoMesList);
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && anoMesList.length > 0,
  });
}

// Fetch comp plans for OTE calculation
export function useRankingCompPlans(sdrIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['ranking-comp-plans', sdrIds],
    queryFn: async () => {
      if (sdrIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('sdr_id, ote_total, vigencia_inicio, vigencia_fim')
        .in('sdr_id', sdrIds)
        .eq('status', 'APPROVED');
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && sdrIds.length > 0,
  });
}

interface PayoutData {
  sdr_id: string;
  total_conta: number | null;
  pct_reunioes_agendadas: number | null;
  pct_reunioes_realizadas: number | null;
  pct_tentativas: number | null;
  pct_no_show: number | null;
  pct_organizacao: number | null;
  sdr?: { id: string; email: string | null; name: string } | null;
}

interface KpiData {
  sdr_id: string;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  tentativas_ligacoes: number;
  no_shows: number;
  intermediacoes_contrato: number;
}

interface CompPlanData {
  sdr_id: string;
  ote_total: number;
}

// Extract payout data from raw response - handles type coercion
export function extractPayoutData(rawPayouts: any[]): PayoutData[] {
  return rawPayouts.map(p => ({
    sdr_id: p.sdr_id,
    total_conta: p.total_conta,
    pct_reunioes_agendadas: p.pct_reunioes_agendadas,
    pct_reunioes_realizadas: p.pct_reunioes_realizadas,
    pct_tentativas: p.pct_tentativas,
    pct_no_show: p.pct_no_show,
    pct_organizacao: p.pct_organizacao,
    sdr: p.sdr,
  }));
}

// Calculate metric value based on selected metric
export function getMetricaValor(
  metrica: MetricaRanking,
  payouts: PayoutData[],
  kpis: KpiData[],
  compPlan: CompPlanData | null
): number {
  if (payouts.length === 0 && kpis.length === 0) return 0;
  
  // Aggregate values across months
  const sumPayout = (field: keyof PayoutData) => 
    payouts.reduce((sum, p) => sum + (Number(p[field]) || 0), 0);
  
  const sumKpi = (field: keyof KpiData) => 
    kpis.reduce((sum, k) => sum + (Number(k[field]) || 0), 0);
  
  const avgPayout = (field: keyof PayoutData) => {
    const values = payouts.map(p => Number(p[field]) || 0).filter(v => v > 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };
  
  switch (metrica) {
    case 'agendamentos':
      return sumKpi('reunioes_agendadas');
      
    case 'realizadas':
      return sumKpi('reunioes_realizadas');
      
    case 'tentativas':
      return sumKpi('tentativas_ligacoes');
      
    case 'contratos':
      return sumKpi('intermediacoes_contrato');
      
    case 'no_show_inverso':
      // Lower is better, so invert: 100 - avg_no_show_pct
      const avgNoShow = avgPayout('pct_no_show');
      return Math.max(0, 100 - avgNoShow);
      
    case 'taxa_conversao':
      const realizadas = sumKpi('reunioes_realizadas');
      const contratos = sumKpi('intermediacoes_contrato');
      return realizadas > 0 ? (contratos / realizadas) * 100 : 0;
      
    case 'ote_pct':
      // Se não tem OTE target configurado, usar % Meta Global (média dos percentuais)
      if (!compPlan?.ote_total || compPlan.ote_total === 0) {
        const pcts = [
          avgPayout('pct_reunioes_agendadas'),
          avgPayout('pct_reunioes_realizadas'),
          avgPayout('pct_tentativas'),
          avgPayout('pct_organizacao'),
        ].filter(p => p > 0);
        
        return pcts.length > 0 
          ? pcts.reduce((a, b) => a + b, 0) / pcts.length 
          : 0;
      }
      
      // Cálculo normal com OTE target
      const totalConta = sumPayout('total_conta');
      const monthlyOte = compPlan.ote_total;
      const avgMonthlyConta = payouts.length > 0 ? totalConta / payouts.length : 0;
      return (avgMonthlyConta / monthlyOte) * 100;
      
    default:
      return 0;
  }
}

// Format metric value for display
export function formatMetricaValor(metrica: MetricaRanking, valor: number): string {
  switch (metrica) {
    case 'agendamentos':
    case 'realizadas':
    case 'tentativas':
    case 'contratos':
      return valor.toFixed(0);
      
    case 'no_show_inverso':
    case 'taxa_conversao':
    case 'ote_pct':
      return `${valor.toFixed(1)}%`;
      
    default:
      return valor.toFixed(0);
  }
}
