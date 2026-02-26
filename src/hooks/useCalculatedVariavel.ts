import { useMemo } from 'react';
import { ActiveMetric, METRIC_CONFIG } from '@/hooks/useActiveMetricsForSdr';
import { SdrMonthKpi, SdrCompPlan, SdrMonthPayout, getMultiplier } from '@/types/sdr-fechamento';

interface CalculatedVariavelParams {
  metricas: ActiveMetric[];
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout | null;
  compPlan: SdrCompPlan | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal: number;
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
 * Calculates the total variable pay by summing up individual indicator values.
 * Uses the SAME logic as DynamicIndicatorCard to ensure visual consistency.
 */
export function useCalculatedVariavel({
  metricas,
  kpi,
  payout,
  compPlan,
  diasUteisMes,
  sdrMetaDiaria,
  variavelTotal,
}: CalculatedVariavelParams): CalculatedVariavelResult {
  return useMemo(() => {
    if (!metricas || metricas.length === 0 || !payout) {
      return { total: 0, indicators: [] };
    }

    const indicators: IndicatorValue[] = [];
    let total = 0;

    for (const metrica of metricas) {
      const config = METRIC_CONFIG[metrica.nome_metrica];
      
      // Skip metrics without config or special ones like no_show
      if (!config || metrica.nome_metrica === 'no_show') {
        continue;
      }

      const kpiValue = kpi ? (kpi as any)[config.kpiField] || 0 : 0;
      let valorBase = 0;
      let mult = 0;
      let valorFinal = 0;

      // For metrics with isDynamicCalc (contratos, vendas_parceria)
      if (config.isDynamicCalc) {
        const baseVariavel = variavelTotal || compPlan?.variavel_total || 400;
        const pesoPercent = metrica.peso_percentual || 25;
        valorBase = baseVariavel * (pesoPercent / 100);

        // Calculate meta and percentage
        let metaAjustada: number;
        
        if (metrica.meta_percentual && metrica.meta_percentual > 0) {
          // Dynamic meta: X% of Realizadas
          const realizadas = kpi?.reunioes_realizadas || 0;
          metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
        } else {
          // Fixed meta: daily value × working days
          const metaDiaria = metrica.meta_valor || 1;
          metaAjustada = metaDiaria * diasUteisMes;
        }

        const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
        mult = getMultiplier(pct);
        valorFinal = valorBase * mult;
      }
      // For standard metrics (agendamentos, realizadas, tentativas, organizacao)
      else if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
        // Calculate meta based on metric type
        let metaAjustada = 0;

        if (metrica.nome_metrica === 'agendamentos') {
          metaAjustada = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
        } else if (metrica.nome_metrica === 'realizadas') {
          // SINCRONIZADO COM KpiEditForm: Usar 70% das agendadas REAIS
          const agendadasReais = kpi?.reunioes_agendadas || 0;
          metaAjustada = Math.round(agendadasReais * 0.7);
        } else if (metrica.nome_metrica === 'tentativas') {
          metaAjustada = (payout as any).meta_tentativas_ajustada ?? (84 * diasUteisMes);
        } else if (metrica.nome_metrica === 'organizacao') {
          metaAjustada = 100;
        }

        // Recalculate percentage and multiplier locally
        const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
        mult = getMultiplier(pct);

        // Priority: if metric has peso_percentual (Closer/dynamic metrics), always use dynamic calc
        // Otherwise, try specific compPlan value first
        if (metrica.peso_percentual && metrica.peso_percentual > 0) {
          // Dynamic calculation based on peso_percentual (same as DynamicIndicatorCard)
          const baseVariavel = variavelTotal || compPlan?.variavel_total || 400;
          valorBase = baseVariavel * (metrica.peso_percentual / 100);
        } else {
          if (config.compPlanValueField && compPlan) {
            const valorEspecifico = (compPlan as any)[config.compPlanValueField] || 0;
            if (valorEspecifico > 0) {
              valorBase = valorEspecifico;
            }
          }

          // Fallback: dynamic calculation if no specific value
          if (valorBase === 0) {
            const baseVariavel = variavelTotal || compPlan?.variavel_total || 400;
            const pesoPercent = metrica.peso_percentual || 25;
            valorBase = baseVariavel * (pesoPercent / 100);
          }
        }

        valorFinal = valorBase * mult;
      }
      // Simple metrics without payout fields (r2_agendadas, outside_sales) - skip for variable calc
      else {
        continue;
      }

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
  }, [metricas, kpi, payout, compPlan, diasUteisMes, sdrMetaDiaria, variavelTotal]);
}
