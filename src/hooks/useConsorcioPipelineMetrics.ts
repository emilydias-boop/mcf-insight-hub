import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';

// Stage IDs for Efeito Alavanca + Clube pipeline (origin 7d7b1cb5)
const EFEITO_ALAVANCA_STAGES = {
  aguardandoDoc: '88b00163-78d7-40e2-ba5a-4c8009943eeb',
  cartaSociosFechada: '2963719b-f614-4cd8-9865-f8aa208ba246',
  aporteHolding: '4d323900-0819-480a-a499-2e0c3599b373',
  cartaAporte: 'fd4d30fc-abfd-4f2f-9260-df4580be3881',
};

// Stage IDs for Viver de Aluguel pipeline (origin 4e2b810a)
const VIVER_ALUGUEL_STAGES = {
  propostaEnviada: '09a0a99e-feee-46df-a817-bc4d0e1ac3d9',
  contratoPago: 'a35fea26-805e-40d5-b604-56fd6319addf',
  vendaRealizada: 'aa194279-c40e-458d-80aa-c5179b414658',
};

const ALL_STAGE_IDS = [
  ...Object.values(EFEITO_ALAVANCA_STAGES),
  ...Object.values(VIVER_ALUGUEL_STAGES),
];

interface PeriodCounts {
  propostaEnviada: number;
  contratoPago: number;
  aguardandoDoc: number;
  cartaSociosFechada: number;
  aporteHolding: number;
  vendaRealizada: number;
}

export interface ConsorcioPipelineMetrics {
  day: PeriodCounts;
  week: PeriodCounts;
  month: PeriodCounts;
  isLoading: boolean;
}

function countByStage(deals: any[]): PeriodCounts {
  const counts: PeriodCounts = {
    propostaEnviada: 0,
    contratoPago: 0,
    aguardandoDoc: 0,
    cartaSociosFechada: 0,
    aporteHolding: 0,
    vendaRealizada: 0,
  };

  deals.forEach(deal => {
    const stageId = deal.stage_id;
    if (stageId === VIVER_ALUGUEL_STAGES.propostaEnviada) counts.propostaEnviada++;
    else if (stageId === VIVER_ALUGUEL_STAGES.contratoPago) counts.contratoPago++;
    else if (stageId === VIVER_ALUGUEL_STAGES.vendaRealizada) counts.vendaRealizada++;
    else if (stageId === EFEITO_ALAVANCA_STAGES.aguardandoDoc) counts.aguardandoDoc++;
    else if (stageId === EFEITO_ALAVANCA_STAGES.cartaSociosFechada) counts.cartaSociosFechada++;
    else if (stageId === EFEITO_ALAVANCA_STAGES.aporteHolding) counts.aporteHolding++;
    else if (stageId === EFEITO_ALAVANCA_STAGES.cartaAporte) {
      // CARTA + APORTE counts as both
      counts.cartaSociosFechada++;
      counts.aporteHolding++;
    }
  });

  return counts;
}

export function useConsorcioPipelineMetrics(): ConsorcioPipelineMetrics {
  const today = new Date();
  const todayNormalized = startOfDay(today);

  const dayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const dayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const weekStart = format(startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const weekEnd = format(endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");

  const { data, isLoading } = useQuery({
    queryKey: ['consorcio-pipeline-metrics', monthStart],
    queryFn: async () => {
      // Fetch all deals currently in these stages that were moved in this month
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select('id, stage_id, stage_moved_at')
        .in('stage_id', ALL_STAGE_IDS)
        .gte('stage_moved_at', monthStart)
        .lte('stage_moved_at', monthEnd);

      if (error) throw error;
      return deals || [];
    },
  });

  const metrics: ConsorcioPipelineMetrics = {
    day: countByStage((data || []).filter(d => d.stage_moved_at >= dayStart && d.stage_moved_at <= dayEnd)),
    week: countByStage((data || []).filter(d => d.stage_moved_at >= weekStart && d.stage_moved_at <= weekEnd)),
    month: countByStage(data || []),
    isLoading,
  };

  return metrics;
}
