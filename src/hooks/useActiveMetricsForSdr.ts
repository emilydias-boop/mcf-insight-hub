import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FechamentoMetricaMes } from '@/types/sdr-fechamento';

export interface ActiveMetric extends FechamentoMetricaMes {
  // Extend with any additional computed fields if needed
}

interface UseActiveMetricsResult {
  metricas: ActiveMetric[];
  isLoading: boolean;
  isError: boolean;
  fonte: 'configuradas' | 'fallback';
}

// Default SDR metrics as fallback
const DEFAULT_SDR_METRICS: Partial<ActiveMetric>[] = [
  { nome_metrica: 'agendamentos', label_exibicao: 'Agendamento', peso_percentual: 25, fonte_dados: 'agenda' },
  { nome_metrica: 'realizadas', label_exibicao: 'Reuniões Realizadas', peso_percentual: 25, fonte_dados: 'agenda' },
  { nome_metrica: 'tentativas', label_exibicao: 'Tentativas de Ligações', peso_percentual: 25, fonte_dados: 'twilio' },
  { nome_metrica: 'organizacao', label_exibicao: 'Organização', peso_percentual: 25, fonte_dados: 'manual' },
];

// Default Closer metrics as fallback
const DEFAULT_CLOSER_METRICS: Partial<ActiveMetric>[] = [
  { nome_metrica: 'realizadas', label_exibicao: 'R1 Realizadas', peso_percentual: 35, fonte_dados: 'agenda' },
  { nome_metrica: 'contratos', label_exibicao: 'Contratos Pagos', peso_percentual: 35, fonte_dados: 'agenda' },
  { nome_metrica: 'no_show', label_exibicao: 'Taxa No-Show', peso_percentual: 0, fonte_dados: 'agenda' },
  { nome_metrica: 'organizacao', label_exibicao: 'Organização', peso_percentual: 20, fonte_dados: 'manual' },
  { nome_metrica: 'vendas_parceria', label_exibicao: 'Vendas Parceria', peso_percentual: 10, fonte_dados: 'hubla' },
];

/**
 * Hook to fetch active metrics for a specific SDR/Closer based on their cargo_catalogo_id.
 * Falls back to default metrics based on role_type if no configured metrics are found.
 */
export const useActiveMetricsForSdr = (sdrId: string | undefined, anoMes: string): UseActiveMetricsResult => {
  const query = useQuery({
    queryKey: ['active-metrics-for-sdr', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId || !anoMes) {
        return { metricas: [], fonte: 'fallback' as const, roleType: 'sdr' };
      }

      // Step 1: Get SDR data to determine role_type
      const { data: sdrData, error: sdrError } = await supabase
        .from('sdr')
        .select('role_type, squad')
        .eq('id', sdrId)
        .single();

      if (sdrError) {
        console.error('Error fetching SDR:', sdrError);
        return { metricas: [], fonte: 'fallback' as const, roleType: 'sdr' };
      }

      const roleType = sdrData?.role_type || 'sdr';
      const squad = sdrData?.squad;

      // Step 2: Get employee linked to this SDR to get cargo_catalogo_id
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('cargo_catalogo_id')
        .eq('sdr_id', sdrId)
        .eq('status', 'ativo')
        .maybeSingle();

      if (employeeError) {
        console.error('Error fetching employee:', employeeError);
        return { metricas: [], fonte: 'fallback' as const, roleType };
      }

      const cargoId = employeeData?.cargo_catalogo_id;

      if (!cargoId) {
        // No cargo found, return default metrics based on role_type
        const defaultMetrics = roleType === 'closer' ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
        return { 
          metricas: defaultMetrics as ActiveMetric[], 
          fonte: 'fallback' as const,
          roleType
        };
      }

      // Step 3: Fetch active metrics from fechamento_metricas_mes
      let query = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', anoMes)
        .eq('cargo_catalogo_id', cargoId)
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      // Add squad filter if present
      if (squad) {
        query = query.eq('squad', squad);
      }

      const { data: metricas, error: metricasError } = await query;

      if (metricasError) {
        console.error('Error fetching metrics:', metricasError);
        return { metricas: [], fonte: 'fallback' as const, roleType };
      }

      if (metricas && metricas.length > 0) {
        return { 
          metricas: metricas as ActiveMetric[], 
          fonte: 'configuradas' as const,
          roleType
        };
      }

      // No configured metrics found, return defaults based on role_type
      const defaultMetrics = roleType === 'closer' ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
      return { 
        metricas: defaultMetrics as ActiveMetric[], 
        fonte: 'fallback' as const,
        roleType
      };
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    metricas: query.data?.metricas || [],
    isLoading: query.isLoading,
    isError: query.isError,
    fonte: query.data?.fonte || 'fallback',
  };
};

/**
 * Hook to fetch active metrics for a cargo (used in EditIndividualPlanDialog)
 */
export const useActiveMetricsForCargo = (cargoId: string | undefined, anoMes: string, squad?: string) => {
  return useQuery({
    queryKey: ['active-metrics-for-cargo', cargoId, anoMes, squad],
    queryFn: async () => {
      if (!cargoId || !anoMes) {
        return [];
      }

      // Step 1: Fetch cargo info to determine if it's a Closer role
      const { data: cargoData } = await supabase
        .from('cargos_catalogo')
        .select('nome_exibicao, area')
        .eq('id', cargoId)
        .single();

      const isCloserRole = cargoData?.nome_exibicao?.toLowerCase().includes('closer') || false;

      // Step 2: Query metrics for this cargo
      // First try to find squad-specific metrics, then fallback to generic (squad=null)
      let query = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', anoMes)
        .eq('cargo_catalogo_id', cargoId)
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (squad) {
        query = query.eq('squad', squad);
      } else {
        // When no squad specified, look for generic metrics (squad=null)
        query = query.is('squad', null);
      }

      let { data, error } = await query;
      
      // If no squad-specific metrics found and squad was specified, try fallback to generic
      if (squad && (!data || data.length === 0)) {
        const { data: genericData, error: genericError } = await supabase
          .from('fechamento_metricas_mes')
          .select('*')
          .eq('ano_mes', anoMes)
          .eq('cargo_catalogo_id', cargoId)
          .eq('ativo', true)
          .is('squad', null)
          .order('created_at', { ascending: true });
        
        if (!genericError && genericData && genericData.length > 0) {
          data = genericData;
        }
      }

      if (error) {
        console.error('Error fetching metrics for cargo:', error);
      }

      // Step 3: Return configured metrics OR fallback based on role type
      if (data && data.length > 0) {
        return data as ActiveMetric[];
      }

      // Return fallback metrics based on cargo type
      const fallbackMetrics = isCloserRole ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
      return fallbackMetrics as ActiveMetric[];
    },
    enabled: !!cargoId && !!anoMes,
    staleTime: 5 * 60 * 1000,
  });
};

// Mapping from metric name to display configuration
export const METRIC_CONFIG: Record<string, {
  icon: string;
  color: string;
  kpiField: string;
  payoutPctField?: string;
  payoutMultField?: string;
  payoutValueField?: string;
  compPlanValueField?: string;
  isPercentage?: boolean;
  isAuto?: boolean;
  autoSource?: string;
  isDynamicCalc?: boolean; // For metrics that use dynamic peso/meta calculation
}> = {
  agendamentos: {
    icon: 'Calendar',
    color: 'green',
    kpiField: 'reunioes_agendadas',
    payoutPctField: 'pct_reunioes_agendadas',
    payoutMultField: 'mult_reunioes_agendadas',
    payoutValueField: 'valor_reunioes_agendadas',
    compPlanValueField: 'valor_meta_rpg',
    isAuto: true,
    autoSource: 'Agenda',
  },
  realizadas: {
    icon: 'Users',
    color: 'blue',
    kpiField: 'reunioes_realizadas',
    payoutPctField: 'pct_reunioes_realizadas',
    payoutMultField: 'mult_reunioes_realizadas',
    payoutValueField: 'valor_reunioes_realizadas',
    compPlanValueField: 'valor_docs_reuniao',
    isAuto: true,
    autoSource: 'Agenda',
  },
  tentativas: {
    icon: 'Phone',
    color: 'purple',
    kpiField: 'tentativas_ligacoes',
    payoutPctField: 'pct_tentativas',
    payoutMultField: 'mult_tentativas',
    payoutValueField: 'valor_tentativas',
    compPlanValueField: 'valor_tentativas',
    isAuto: true,
    autoSource: 'Twilio',
  },
  organizacao: {
    icon: 'ClipboardCheck',
    color: 'yellow',
    kpiField: 'score_organizacao',
    payoutPctField: 'pct_organizacao',
    payoutMultField: 'mult_organizacao',
    payoutValueField: 'valor_organizacao',
    compPlanValueField: 'valor_organizacao',
    isPercentage: true,
    isAuto: false,
    autoSource: 'Manual',
  },
  contratos: {
    icon: 'FileCheck',
    color: 'green',
    kpiField: 'intermediacoes_contrato',
    // Contratos usa cálculo dinâmico baseado em peso/meta configurados
    isDynamicCalc: true,
    isAuto: true,
    autoSource: 'Agenda',
  },
  r2_agendadas: {
    icon: 'CalendarPlus',
    color: 'purple',
    kpiField: 'r2_agendadas',
    isAuto: true,
    autoSource: 'Agenda',
  },
  no_show: {
    icon: 'AlertTriangle',
    color: 'red',
    kpiField: 'no_shows',
    isAuto: true,
    autoSource: 'Agenda',
  },
  outside_sales: {
    icon: 'Sparkles',
    color: 'primary',
    kpiField: 'outside_sales',
    isAuto: true,
    autoSource: 'Agenda',
  },
  vendas_parceria: {
    icon: 'Sparkles',
    color: 'purple',
    kpiField: 'vendas_parceria',
    // Vendas parceria usa cálculo dinâmico baseado em peso/meta configurados
    isDynamicCalc: true,
    isAuto: true,
    autoSource: 'Agenda',
  },
};

// Get label for metric value field
export const getMetricValueLabel = (nomeMetrica: string): string => {
  const labels: Record<string, string> = {
    agendamentos: 'Agendadas (R$)',
    realizadas: 'Realizadas (R$)',
    tentativas: 'Tentativas (R$)',
    organizacao: 'Organização (R$)',
    contratos: 'Contratos (R$)',
    r2_agendadas: 'R2 Agendadas (R$)',
  };
  return labels[nomeMetrica] || `${nomeMetrica} (R$)`;
};
