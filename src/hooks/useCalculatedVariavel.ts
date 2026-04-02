import { useMemo } from 'react';
import { ActiveMetric, METRIC_CONFIG } from '@/hooks/useActiveMetricsForSdr';
import { SdrMonthKpi, SdrMonthPayout, getMultiplier } from '@/types/sdr-fechamento';

interface CalculatedVariavelParams {
  metricas: ActiveMetric[];
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal: number;
  diasUteisTrabalhados?: number | null;
}

interface IndicatorValue {
  nomeMetrica: string;
  label: string;
  valorBase: number;
  multiplicador: number;
  valorFinal: number;
}

interface CalculatedVariavelResult {
  total: number;
  indicators: IndicatorValue[];
}

/**
 * Calculates meta for a given metric based on its type.
 * Unified logic used by both useCalculatedVariavel and DynamicIndicatorCard.
 */
function calcularMeta(
  metrica: ActiveMetric,
  kpi: SdrMonthKpi | null,
  payout: SdrMonthPayout | null,
  diasUteisMes: number,
  sdrMetaDiaria: number,
  proRataRatio: number,
): number {
  const nome = metrica.nome_metrica;

  if (nome === 'agendamentos') {
    let meta = (payout as any)?.meta_agendadas_ajustada || (sdrMetaDiaria * diasUteisMes);
    if (proRataRatio < 1 && !(payout as any)?.meta_agendadas_ajustada) {
      meta = Math.round(meta * proRataRatio);
    }
    return meta;
  }

  if (nome === 'realizadas') {
    const agendadasReais = kpi?.reunioes_agendadas || 0;
    return Math.round(agendadasReais * 0.7);
  }

  if (nome === 'tentativas') {
    let meta = (payout as any)?.meta_tentativas_ajustada ?? (84 * diasUteisMes);
    if (proRataRatio < 1 && !(payout as any)?.meta_tentativas_ajustada) {
      meta = Math.round(meta * proRataRatio);
    }
    return meta;
  }

  if (nome === 'organizacao') {
    return 100;
  }

  if (nome === 'r2_agendadas') {
    const contratosPagos = kpi?.intermediacoes_contrato || 0;
    const pct = metrica.meta_percentual && metrica.meta_percentual > 0 ? metrica.meta_percentual : 100;
    return Math.round((contratosPagos * pct) / 100);
  }

  if (metrica.meta_percentual && metrica.meta_percentual > 0) {
    const realizadas = kpi?.reunioes_realizadas || 0;
    return Math.round((realizadas * metrica.meta_percentual) / 100);
  }

  if (nome === 'contratos') {
    const realizadas = kpi?.reunioes_realizadas || 0;
    const pct = metrica.meta_percentual && metrica.meta_percentual > 0 ? metrica.meta_percentual : 30;
    return Math.round((realizadas * pct) / 100);
  }

  // Fixed meta: daily value × working days
  const metaDiaria = metrica.meta_valor || 1;
  return metaDiaria * diasUteisMes;
}

/**
 * Calculates the total variable pay by summing up individual indicator values.
 * All metrics use unified weight-based calculation from fechamento_metricas_mes.
 */
export function useCalculatedVariavel({
  metricas,
  kpi,
  payout,
  diasUteisMes,
  sdrMetaDiaria,
  variavelTotal,
  diasUteisTrabalhados,
}: CalculatedVariavelParams): CalculatedVariavelResult {
  return useMemo(() => {
    if (!metricas || metricas.length === 0 || !payout) {
      return { total: 0, indicators: [] };
    }

    const proRataRatio = (diasUteisTrabalhados != null && diasUteisTrabalhados < diasUteisMes && diasUteisMes > 0)
      ? diasUteisTrabalhados / diasUteisMes
      : 1;

    const baseVariavel = variavelTotal || 400;
    const indicators: IndicatorValue[] = [];
    let total = 0;

    for (const metrica of metricas) {
      const config = METRIC_CONFIG[metrica.nome_metrica];
      if (!config || metrica.nome_metrica === 'no_show') continue;

      const kpiValue = kpi ? (kpi as any)[config.kpiField] || 0 : 0;

      // Unified: all metrics use peso_percentual
      const pesoPercent = metrica.peso_percentual && metrica.peso_percentual > 0
        ? metrica.peso_percentual
        : (100 / metricas.filter(m => m.nome_metrica !== 'no_show').length);
      const valorBase = baseVariavel * (pesoPercent / 100);

      const metaAjustada = calcularMeta(metrica, kpi, payout, diasUteisMes, sdrMetaDiaria, proRataRatio);
      const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
      const mult = getMultiplier(pct);
      const valorFinal = valorBase * mult;

      indicators.push({
        nomeMetrica: metrica.nome_metrica,
        label: metrica.label_exibicao,
        valorBase,
        multiplicador: mult,
        valorFinal,
      });

      total += valorFinal;
    }

    return { total, indicators };
  }, [metricas, kpi, payout, diasUteisMes, sdrMetaDiaria, variavelTotal, diasUteisTrabalhados]);
}
