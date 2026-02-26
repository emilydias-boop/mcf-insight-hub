import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { 
  Sdr, 
  SdrCompPlan, 
  SdrMonthKpi, 
  SdrMonthPayout, 
  SdrPayoutWithDetails,
  PayoutStatus,
  PayoutAdjustment,
  getMultiplier,
  calculateNoShowPerformance 
} from '@/types/sdr-fechamento';

// Tipo para métricas ativas vindas do banco
interface ActiveMetric {
  nome_metrica: string;
  peso_percentual: number;
  meta_valor: number | null;
  label_exibicao: string;
}

// Métricas padrão para SDR (caso não haja configuração)
const DEFAULT_SDR_METRICS: ActiveMetric[] = [
  { nome_metrica: 'agendamentos', peso_percentual: 33.33, meta_valor: null, label_exibicao: 'R1 Agendadas' },
  { nome_metrica: 'realizadas', peso_percentual: 33.33, meta_valor: null, label_exibicao: 'R1 Realizadas' },
  { nome_metrica: 'tentativas', peso_percentual: 16.67, meta_valor: null, label_exibicao: 'Tentativas' },
  { nome_metrica: 'organizacao', peso_percentual: 16.67, meta_valor: null, label_exibicao: 'Organização' },
];

// Métricas padrão para Closer (caso não haja configuração)
const DEFAULT_CLOSER_METRICS: ActiveMetric[] = [
  { nome_metrica: 'realizadas', peso_percentual: 40, meta_valor: null, label_exibicao: 'R1 Realizadas' },
  { nome_metrica: 'contratos', peso_percentual: 40, meta_valor: null, label_exibicao: 'Contratos Pagos' },
  { nome_metrica: 'organizacao', peso_percentual: 20, meta_valor: null, label_exibicao: 'Organização' },
];

// Fetch all active SDRs
export const useSdrs = () => {
  return useQuery({
    queryKey: ['sdrs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as unknown as Sdr[];
    },
  });
};

// Fetch SDRs filtered by BU/squad
export const useSdrsByBU = (bu: string | null) => {
  return useQuery({
    queryKey: ['sdrs-by-bu', bu],
    queryFn: async () => {
      if (!bu) return [];
      const { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('active', true)
        .eq('squad', bu)
        .order('name');
      if (error) throw error;
      return data as unknown as Sdr[];
    },
    enabled: !!bu,
  });
};

// Fetch SDR by user_id (for SDR's own view)
export const useOwnSdr = () => {
  return useQuery({
    queryKey: ['own-sdr'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as Sdr;
    },
  });
};

// Fetch comp plan for an SDR (vigente)
export const useSdrCompPlan = (sdrId: string | undefined, anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-comp-plan', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId || !anoMes) return null;
      
      // Parse ano_mes to get the month's date range
      const [year, month] = anoMes.split('-').map(Number);
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('*')
        .eq('sdr_id', sdrId)
        .neq('status', 'REJECTED') // Incluir planos PENDING, APPROVED, active etc.
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SdrCompPlan | null;
    },
    enabled: !!sdrId && !!anoMes,
  });
};

// Fetch KPIs for an SDR/month
export const useSdrMonthKpi = (sdrId: string | undefined, anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-month-kpi', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId || !anoMes) return null;
      
      const { data, error } = await supabase
        .from('sdr_month_kpi')
        .select('*')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SdrMonthKpi | null;
    },
    enabled: !!sdrId && !!anoMes,
  });
};

// Helper to transform DB result to typed payout
const transformPayout = (data: any): SdrPayoutWithDetails => ({
  ...data,
  ajustes_json: (data.ajustes_json as PayoutAdjustment[]) || [],
  status: data.status as PayoutStatus,
});

// Normaliza qualquer variação de departamento para a chave canônica de BU
const normalizeDeptToBU = (dept: string | null | undefined): string | null => {
  if (!dept) return null;
  const lower = dept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('incorporador')) return 'incorporador';
  if (lower.includes('consorcio')) return 'consorcio';
  if (lower.includes('credito')) return 'credito';
  if (lower.includes('projeto')) return 'projetos';
  if (lower.includes('leilao')) return 'leilao';
  if (lower.includes('marketing')) return 'marketing';
  return null;
};

// Mapeamento de squad para departamento RH (mantido para compatibilidade)
const SQUAD_TO_DEPT: Record<string, string> = {
  'incorporador': 'BU - Incorporador 50K',
  'consorcio': 'BU - Consórcio',
  'credito': 'BU - Crédito',
  'projetos': 'BU - Projetos',
};

const DEPT_TO_SQUAD: Record<string, string> = {
  'BU - Incorporador 50K': 'incorporador',
  'BU - Consórcio': 'consorcio',
  'BU - Crédito': 'credito',
  'BU - Projetos': 'projetos',
};

// Fetch all payouts for a month with filters (using HR department as source of truth)
export const useSdrPayouts = (anoMes: string, filters?: {
  roleType?: 'sdr' | 'closer' | 'all';
  squad?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['sdr-payouts', anoMes, filters],
    queryFn: async () => {
      // Step 1: Fetch payouts with SDR data (including departamento_vigente)
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
        `)
        .eq('ano_mes', anoMes)
        .order('created_at');
      
      if (payoutsError) throw payoutsError;

      // Step 2: Fetch ACTIVE employees linked to SDRs to get HR department + cargo_catalogo (source of truth)
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select(`
          id, 
          nome_completo, 
          departamento, 
          cargo, 
          sdr_id, 
          status,
          cargo_catalogo_id,
          fechamento_manual,
          cargo_catalogo:cargo_catalogo_id (
            id,
            nome_exibicao,
            nivel,
            ote_total,
            fixo_valor,
            variavel_valor,
            area,
            cargo_base
          )
        `)
        .not('sdr_id', 'is', null)
        .eq('status', 'ativo')
        .order('updated_at', { ascending: false });
      
      if (empError) throw empError;

      // Create a map of sdr_id → employee for quick lookup (use first match = most recently updated)
      interface EmployeeWithCargo {
        departamento: string | null;
        cargo: string | null;
        nome_completo: string;
        cargo_catalogo_id: string | null;
        fechamento_manual: boolean | null;
        cargo_catalogo: {
          id: string;
          nome_exibicao: string;
          nivel: number | null;
          ote_total: number;
          fixo_valor: number;
          variavel_valor: number;
          area: string;
          cargo_base: string;
        } | null;
      }
      const sdrToEmployee = new Map<string, EmployeeWithCargo>();
      employees?.forEach(emp => {
        // Only set if not already set (first match = most recent)
        if (emp.sdr_id && !sdrToEmployee.has(emp.sdr_id)) {
          sdrToEmployee.set(emp.sdr_id, {
            departamento: emp.departamento,
            cargo: emp.cargo,
            nome_completo: emp.nome_completo,
            cargo_catalogo_id: emp.cargo_catalogo_id,
            fechamento_manual: (emp as any).fechamento_manual || false,
            cargo_catalogo: emp.cargo_catalogo as EmployeeWithCargo['cargo_catalogo'],
          });
        }
      });
      
      // Step 3: Enrich payouts with HR data
      let result = (payoutsData || []).map(data => {
        const payout = transformPayout(data);
        const employee = sdrToEmployee.get(payout.sdr_id);
        
        // Attach employee data to payout for display
        (payout as any).employee = employee || null;
        
        return payout;
      });
      
      // Apply filters
      if (filters) {
        // Only show active SDRs
        result = result.filter(p => p.sdr?.active !== false);
        
        // Exclude R2 Partners (sócios) from closing
        result = result.filter(p => {
          const employee = (p as any).employee;
          if (employee?.cargo === 'Closer R2') {
            return false;
          }
          return true;
        });
        
        // Filter by role type
        if (filters.roleType && filters.roleType !== 'all') {
          result = result.filter(p => (p.sdr as any)?.role_type === filters.roleType);
        }
        
        // Filter by squad/BU - Use normalized canonical BU key
        // Cascaded priority: departamento_vigente > employees.departamento > sdr.squad
        if (filters.squad && filters.squad !== 'all') {
          result = result.filter(p => {
            // 1. Priority: Frozen department from payout (departamento_vigente)
            const frozenDept = (p as any).departamento_vigente;
            const canonicalFromFrozen = normalizeDeptToBU(frozenDept);
            if (canonicalFromFrozen) {
              return canonicalFromFrozen === filters.squad;
            }
            
            // 2. Fallback: Current HR department
            const employee = (p as any).employee;
            const canonicalFromHR = normalizeDeptToBU(employee?.departamento);
            if (canonicalFromHR) {
              return canonicalFromHR === filters.squad;
            }
            
            // 3. Final fallback: sdr.squad for orphans
            return (p.sdr as any)?.squad === filters.squad;
          });
        }
        
        // Filter by search
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          result = result.filter(p => {
            const employee = (p as any).employee;
            return (
              p.sdr?.name?.toLowerCase().includes(searchLower) ||
              p.sdr?.email?.toLowerCase().includes(searchLower) ||
              employee?.nome_completo?.toLowerCase().includes(searchLower)
            );
          });
        }
      }
      
      return result;
    },
  });
};

// Fetch single payout detail
// Tipo para employee com cargo_catalogo
interface EmployeeWithCargoCatalogo {
  cargo_catalogo_id: string | null;
  departamento: string | null;
  cargo: string | null;
  cargo_catalogo: {
    id: string;
    nome_exibicao: string;
    nivel: number | null;
    ote_total: number;
    fixo_valor: number;
    variavel_valor: number;
    area: string;
    cargo_base: string;
  } | null;
}

export const useSdrPayoutDetail = (payoutId: string | undefined) => {
  return useQuery({
    queryKey: ['sdr-payout-detail', payoutId],
    queryFn: async () => {
      if (!payoutId) return null;
      
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
        `)
        .eq('id', payoutId)
        .single();
      
      if (error) throw error;
      
      // Fetch employee data for cargo_catalogo (OTE source of truth)
      const { data: employeeData } = await supabase
        .from('employees')
        .select(`
          cargo_catalogo_id,
          departamento,
          cargo,
          fechamento_manual,
          cargo_catalogo:cargo_catalogo_id (
            id, nome_exibicao, nivel, ote_total, fixo_valor, variavel_valor, area, cargo_base
          )
        `)
        .eq('sdr_id', data.sdr_id)
        .eq('status', 'ativo')
        .maybeSingle();
      
      const payout = transformPayout(data);
      (payout as any).employee = employeeData as EmployeeWithCargoCatalogo | null;
      
      return payout;
    },
    enabled: !!payoutId,
  });
};

// Fetch own payout for a month (for SDR view)
export const useOwnPayout = (anoMes: string) => {
  return useQuery({
    queryKey: ['own-payout', anoMes],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First get the SDR record for this user
      const { data: sdrData, error: sdrError } = await supabase
        .from('sdr')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (sdrError) {
        if (sdrError.code === 'PGRST116') return null;
        throw sdrError;
      }

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
        `)
        .eq('sdr_id', sdrData.id)
        .eq('ano_mes', anoMes)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? transformPayout(data) : null;
    },
  });
};

// Constantes de metas fixas (iguais à edge function)
const META_TENTATIVAS_DIARIA = 84; // Meta fixa de 84 tentativas por dia
const META_ORGANIZACAO = 100; // Meta fixa de 100%

// Helper para calcular performance de cada métrica
const calculateMetricPerformance = (
  metricName: string,
  kpi: SdrMonthKpi,
  compPlan: SdrCompPlan,
  diasUteis: number,
  metaDiaria?: number,
  metaPersonalizada?: number | null
): { meta: number; realizado: number; pct: number } => {
  switch (metricName) {
    case 'agendamentos':
      const metaAgendadas = metaPersonalizada || (metaDiaria || 0) * diasUteis;
      return {
        meta: metaAgendadas,
        realizado: kpi.reunioes_agendadas,
        pct: metaAgendadas > 0 
          ? (kpi.reunioes_agendadas / metaAgendadas) * 100 
          : 0,
      };
    
    case 'realizadas':
      // Meta = 70% do que foi REALMENTE agendado (ou meta personalizada)
      const metaRealizadas = metaPersonalizada || Math.round(kpi.reunioes_agendadas * 0.7);
      return {
        meta: metaRealizadas,
        realizado: kpi.reunioes_realizadas,
        pct: metaRealizadas > 0 
          ? (kpi.reunioes_realizadas / metaRealizadas) * 100 
          : 0,
      };
    
    case 'tentativas':
      const metaTentativas = metaPersonalizada || META_TENTATIVAS_DIARIA * diasUteis;
      return {
        meta: metaTentativas,
        realizado: kpi.tentativas_ligacoes,
        pct: metaTentativas > 0 
          ? (kpi.tentativas_ligacoes / metaTentativas) * 100 
          : 0,
      };
    
    case 'organizacao':
      return {
        meta: metaPersonalizada || META_ORGANIZACAO,
        realizado: kpi.score_organizacao,
        pct: kpi.score_organizacao, // já é percentual
      };
    
    case 'no_show':
      return {
        meta: metaPersonalizada || 30, // Meta de no-show = 30% máximo
        realizado: kpi.no_shows,
        pct: calculateNoShowPerformance(kpi.no_shows, kpi.reunioes_agendadas),
      };
    
    case 'contratos':
      const metaContratos = metaPersonalizada || compPlan.meta_reunioes_realizadas || 10;
      return {
        meta: metaContratos,
        realizado: kpi.intermediacoes_contrato,
        pct: metaContratos > 0 
          ? (kpi.intermediacoes_contrato / metaContratos) * 100 
          : 0,
      };
    
    case 'r2_agendadas':
      const metaR2 = metaPersonalizada || 10;
      // Usamos intermediacoes_contrato como proxy para R2 agendadas por enquanto
      return {
        meta: metaR2,
        realizado: 0, // TODO: adicionar campo específico quando disponível
        pct: 0,
      };
    
    case 'outside_sales':
      return {
        meta: metaPersonalizada || 100,
        realizado: 0, // TODO: campo manual
        pct: 0,
      };
    
    default:
      return { meta: 0, realizado: 0, pct: 0 };
  }
};

// Cálculo dinâmico usando métricas ativas
const calculatePayoutValuesDynamic = (
  compPlan: SdrCompPlan,
  kpi: SdrMonthKpi,
  activeMetrics: ActiveMetric[],
  sdrMetaDiaria?: number,
  diasUteisMes?: number
) => {
  const diasUteisReal = diasUteisMes || compPlan.dias_uteis || 19;
  const variavelTotal = compPlan.variavel_total;

  // Resultados por métrica
  const metricsResults: Record<string, {
    meta: number;
    realizado: number;
    pct: number;
    mult: number;
    valorBase: number;
    valorFinal: number;
    peso: number;
  }> = {};

  // Para cada métrica ativa, calcular: valor_base = variavel × peso%
  // e aplicar multiplicador baseado na performance
  activeMetrics.forEach(metric => {
    const valorBase = variavelTotal * (metric.peso_percentual / 100);
    const { meta, realizado, pct } = calculateMetricPerformance(
      metric.nome_metrica, 
      kpi, 
      compPlan, 
      diasUteisReal, 
      sdrMetaDiaria,
      metric.meta_valor
    );
    const mult = getMultiplier(pct);
    const valorFinal = valorBase * mult;

    metricsResults[metric.nome_metrica] = {
      meta,
      realizado,
      pct,
      mult,
      valorBase,
      valorFinal,
      peso: metric.peso_percentual,
    };
  });

  // Soma todos os valores finais
  const valorVariavelTotal = Object.values(metricsResults)
    .reduce((sum, r) => sum + r.valorFinal, 0);

  const valorFixo = compPlan.fixo_valor;
  const totalConta = valorFixo + valorVariavelTotal;

  // Mapear resultados para campos legado (compatibilidade)
  const agendamentos = metricsResults['agendamentos'] || { pct: 0, mult: 0, valorFinal: 0, meta: 0 };
  const realizadas = metricsResults['realizadas'] || { pct: 0, mult: 0, valorFinal: 0, meta: 0 };
  const tentativas = metricsResults['tentativas'] || { pct: 0, mult: 0, valorFinal: 0, meta: 0 };
  const organizacao = metricsResults['organizacao'] || { pct: 0, mult: 0, valorFinal: 0, meta: 0 };
  const noShow = metricsResults['no_show'] || { pct: 0, mult: 0, valorFinal: 0, meta: 0 };

  // Média global para iFood (apenas métricas que existem)
  const metricsWithValues = Object.values(metricsResults).filter(m => m.pct > 0 || m.realizado > 0);
  const pctMediaGlobal = metricsWithValues.length > 0
    ? metricsWithValues.reduce((sum, m) => sum + m.pct, 0) / metricsWithValues.length
    : 0;

  const ifoodMensal = compPlan.ifood_mensal;
  const ifoodUltrameta = pctMediaGlobal >= 100 ? compPlan.ifood_ultrameta : 0;
  const totalIfood = ifoodMensal + ifoodUltrameta;

  return {
    // Campos legado para compatibilidade com UI existente
    pct_reunioes_agendadas: agendamentos.pct,
    pct_reunioes_realizadas: realizadas.pct,
    pct_tentativas: tentativas.pct,
    pct_organizacao: organizacao.pct,
    pct_no_show: noShow.pct,
    mult_reunioes_agendadas: agendamentos.mult,
    mult_reunioes_realizadas: realizadas.mult,
    mult_tentativas: tentativas.mult,
    mult_organizacao: organizacao.mult,
    mult_no_show: noShow.mult,
    valor_reunioes_agendadas: agendamentos.valorFinal,
    valor_reunioes_realizadas: realizadas.valorFinal,
    valor_tentativas: tentativas.valorFinal,
    valor_organizacao: organizacao.valorFinal,
    valor_no_show: noShow.valorFinal,
    // Metas ajustadas
    meta_agendadas_ajustada: agendamentos.meta,
    meta_realizadas_ajustada: realizadas.meta,
    meta_tentativas_ajustada: tentativas.meta,
    dias_uteis_mes: diasUteisReal,
    // Totais
    valor_variavel_total: valorVariavelTotal,
    valor_fixo: valorFixo,
    total_conta: totalConta,
    // iFood
    ifood_mensal: ifoodMensal,
    ifood_ultrameta: ifoodUltrameta,
    total_ifood: totalIfood,
  };
};

// NOTE: calculatePayoutValues legado removido — era apenas wrapper de calculatePayoutValuesDynamic

// Helper para buscar métricas ativas do cargo
const fetchActiveMetricsForCargo = async (
  cargoId: string | null,
  anoMes: string,
  isCloser: boolean
): Promise<ActiveMetric[]> => {
  if (!cargoId) {
    return isCloser ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
  }

  // Buscar métricas configuradas para o cargo/mês (sem squad = genérico)
  const { data: metrics } = await supabase
    .from('fechamento_metricas_mes')
    .select('nome_metrica, peso_percentual, meta_valor, label_exibicao')
    .eq('ano_mes', anoMes)
    .eq('cargo_catalogo_id', cargoId)
    .is('squad', null)
    .eq('ativo', true);

  if (metrics && metrics.length > 0) {
    return metrics;
  }

  // Fallback: métricas padrão baseado no tipo
  return isCloser ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
};

// Recalculate a single payout
export const useRecalculatePayout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sdrId, anoMes }: { sdrId: string; anoMes: string }) => {
      // Get comp plan
      const [year, month] = anoMes.split('-').map(Number);
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

      const { data: compPlan, error: compError } = await supabase
        .from('sdr_comp_plan')
        .select('*')
        .eq('sdr_id', sdrId)
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .single();

      if (compError) throw new Error('Plano de compensação não encontrado');

      // Get SDR record for meta_diaria
      const { data: sdrRecord } = await supabase
        .from('sdr')
        .select('meta_diaria, role_type')
        .eq('id', sdrId)
        .single();

      // Get or create KPI
      let { data: kpi, error: kpiError } = await supabase
        .from('sdr_month_kpi')
        .select('*')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .single();

      if (kpiError && kpiError.code === 'PGRST116') {
        // Create empty KPI
        const { data: newKpi, error: createError } = await supabase
          .from('sdr_month_kpi')
          .insert({ sdr_id: sdrId, ano_mes: anoMes })
          .select()
          .single();
        
        if (createError) throw createError;
        kpi = newKpi;
      } else if (kpiError) {
        throw kpiError;
      }

      // Get employee linked to SDR to get cargo_catalogo_id and department
      const { data: employeeData } = await supabase
        .from('employees')
        .select(`
          departamento, 
          cargo_catalogo_id,
          cargo_catalogo:cargo_catalogo_id (
            nome_exibicao,
            cargo_base
          )
        `)
        .eq('sdr_id', sdrId)
        .eq('status', 'ativo')
        .maybeSingle();

      // Determinar se é Closer baseado no cargo ou role_type
      const cargoNome = (employeeData?.cargo_catalogo as any)?.nome_exibicao || '';
      const cargoBase = (employeeData?.cargo_catalogo as any)?.cargo_base || '';
      const isCloser = 
        cargoNome.toLowerCase().includes('closer') ||
        cargoBase.toLowerCase().includes('closer') ||
        sdrRecord?.role_type === 'closer';

      // Buscar métricas ativas para o cargo
      const activeMetrics = await fetchActiveMetricsForCargo(
        employeeData?.cargo_catalogo_id || null,
        anoMes,
        isCloser
      );

      // Calculate values using dynamic metrics
      const calculatedValues = calculatePayoutValuesDynamic(
        compPlan as SdrCompPlan, 
        kpi as SdrMonthKpi,
        activeMetrics,
        sdrRecord?.meta_diaria
      );

      // Upsert payout with departamento_vigente
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .upsert({
          sdr_id: sdrId,
          ano_mes: anoMes,
          departamento_vigente: employeeData?.departamento || null,
          ...calculatedValues,
          status: 'DRAFT',
        }, {
          onConflict: 'sdr_id,ano_mes',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts', variables.anoMes] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      toast.success('Fechamento recalculado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao recalcular: ${error.message}`);
    },
  });
};

// Default OTE values by SDR level for fallback when no comp_plan exists
const DEFAULT_OTE_BY_LEVEL: Record<number, { ote_total: number; fixo_valor: number; variavel_total: number }> = {
  1: { ote_total: 4000, fixo_valor: 2800, variavel_total: 1200 },
  2: { ote_total: 4500, fixo_valor: 3150, variavel_total: 1350 },
  3: { ote_total: 5000, fixo_valor: 3500, variavel_total: 1500 },
  4: { ote_total: 5500, fixo_valor: 3850, variavel_total: 1650 },
  5: { ote_total: 6000, fixo_valor: 4200, variavel_total: 1800 },
};

// Create fallback comp_plan when SDR doesn't have one configured
async function createFallbackCompPlan(
  sdrId: string, 
  anoMes: string, 
  nivel: number,
  employeeData?: any
): Promise<SdrCompPlan | null> {
  const [year, month] = anoMes.split('-').map(Number);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  
  // Try to get OTE from cargo_catalogo first
  let oteValues = DEFAULT_OTE_BY_LEVEL[nivel] || DEFAULT_OTE_BY_LEVEL[1];
  
  if (employeeData?.cargo_catalogo_id) {
    const { data: cargo } = await supabase
      .from('cargos_catalogo')
      .select('ote_total, fixo_valor, variavel_valor')
      .eq('id', employeeData.cargo_catalogo_id)
      .single();
    
    if (cargo && cargo.ote_total > 0) {
      oteValues = {
        ote_total: cargo.ote_total,
        fixo_valor: cargo.fixo_valor,
        variavel_total: cargo.variavel_valor,
      };
    }
  }
  
  // Create comp_plan with fallback values
  const newPlan = {
    sdr_id: sdrId,
    vigencia_inicio: monthStart,
    vigencia_fim: null,
    ote_total: oteValues.ote_total,
    fixo_valor: oteValues.fixo_valor,
    variavel_total: oteValues.variavel_total,
    // Default metric values
    valor_meta_rpg: Math.round(oteValues.variavel_total * 0.35),
    valor_docs_reuniao: Math.round(oteValues.variavel_total * 0.35),
    valor_tentativas: Math.round(oteValues.variavel_total * 0.15),
    valor_organizacao: Math.round(oteValues.variavel_total * 0.15),
    ifood_mensal: 150,
    ifood_ultrameta: 50,
    meta_reunioes_agendadas: 15,
    meta_reunioes_realizadas: 12,
    meta_tentativas: 400,
    meta_organizacao: 100,
    dias_uteis: 22,
    meta_no_show_pct: 30,
    status: 'APPROVED' as const,
  };
  
  const { data: createdPlan, error } = await supabase
    .from('sdr_comp_plan')
    .insert(newPlan)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating fallback comp_plan:', error);
    return null;
  }
  
  return createdPlan as SdrCompPlan;
}
// NOTE: useRecalculateAllPayouts removido — o botão "Recalcular Todos" usa a Edge Function diretamente via recalculateViaEdge

// Update payout status
export const useUpdatePayoutStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      status, 
      userId 
    }: { 
      payoutId: string; 
      status: PayoutStatus; 
      userId: string;
    }) => {
      const updateData: Record<string, any> = { status };
      
      if (status === 'APPROVED') {
        updateData.aprovado_por = userId;
        updateData.aprovado_em = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .update(updateData)
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      // Log the status change
      await supabase.from('sdr_payout_audit_log').insert({
        payout_id: payoutId,
        user_id: userId,
        campo: 'status',
        valor_novo: status,
        motivo: `Status alterado para ${status}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
};

// Add adjustment
export const useAddAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      adjustment,
      userId,
    }: { 
      payoutId: string; 
      adjustment: Omit<PayoutAdjustment, 'created_at' | 'created_by'>;
      userId: string;
    }) => {
      // Get current payout
      const { data: payout, error: fetchError } = await supabase
        .from('sdr_month_payout')
        .select('ajustes_json, valor_variavel_total, total_conta')
        .eq('id', payoutId)
        .single();

      if (fetchError) throw fetchError;

      const currentAdjustments = (payout.ajustes_json as unknown as PayoutAdjustment[]) || [];
      const newAdjustment: PayoutAdjustment = {
        ...adjustment,
        created_at: new Date().toISOString(),
        created_by: userId,
      };

      const updatedAdjustments = [...currentAdjustments, newAdjustment];

      // Recalculate totals with adjustment
      const newVariavelTotal = (payout.valor_variavel_total || 0) + adjustment.valor;
      const newTotalConta = (payout.total_conta || 0) + adjustment.valor;

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .update({
          ajustes_json: updatedAdjustments as unknown as Json,
          valor_variavel_total: newVariavelTotal,
          total_conta: newTotalConta,
        })
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      // Log the adjustment
      await supabase.from('sdr_payout_audit_log').insert({
        payout_id: payoutId,
        user_id: userId,
        campo: 'ajustes_json',
        valor_novo: JSON.stringify(newAdjustment),
        motivo: adjustment.motivo,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      toast.success('Ajuste adicionado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar ajuste: ${error.message}`);
    },
  });
};

// Update iFood ultrameta authorization
export const useUpdateIfoodAuthorization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      authorized, 
      userId 
    }: { 
      payoutId: string; 
      authorized: boolean; 
      userId: string;
    }) => {
      const updateData: Record<string, any> = {
        ifood_ultrameta_autorizado: authorized,
      };
      
      if (authorized) {
        updateData.ifood_ultrameta_autorizado_por = userId;
        updateData.ifood_ultrameta_autorizado_em = new Date().toISOString();
      }

      // Get current payout to recalculate total_ifood
      const { data: currentPayout } = await supabase
        .from('sdr_month_payout')
        .select('ifood_mensal, ifood_ultrameta')
        .eq('id', payoutId)
        .single();

      if (currentPayout) {
        updateData.total_ifood = (currentPayout.ifood_mensal || 0) + (authorized ? (currentPayout.ifood_ultrameta || 0) : 0);
      }

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .update(updateData)
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      // Log the change
      await supabase.from('sdr_payout_audit_log').insert({
        payout_id: payoutId,
        user_id: userId,
        campo: 'ifood_ultrameta_autorizado',
        valor_novo: String(authorized),
        motivo: authorized ? 'Ultrameta iFood autorizada' : 'Ultrameta iFood revogada',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      toast.success('Autorização atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Fetch all SDRs (including inactive) for admin
export const useSdrsAll = () => {
  return useQuery({
    queryKey: ['sdrs-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as unknown as Sdr[];
    },
  });
};

// Fetch all comp plans
export const useAllCompPlans = () => {
  return useQuery({
    queryKey: ['comp-plans-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select(`
          *,
          sdr:sdr_id(name)
        `)
        .order('vigencia_inicio', { ascending: false });
      
      if (error) throw error;
      return data as (SdrCompPlan & { sdr: { name: string } })[];
    },
  });
};

// Create SDR (com vínculo automático ao employee se user_id for fornecido)
export const useCreateSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sdr: Omit<Partial<Sdr>, 'name'> & { name: string }) => {
      // 1. Criar o registro SDR
      const { data, error } = await supabase
        .from('sdr')
        .insert([sdr as any])
        .select()
        .single();

      if (error) throw error;

      // 2. Se user_id foi fornecido, vincular automaticamente ao employee
      if (sdr.user_id && data?.id) {
        const { error: empError } = await supabase
          .from('employees')
          .update({ sdr_id: data.id })
          .eq('user_id', sdr.user_id);
        
        if (empError) {
          console.warn('Não foi possível vincular employee automaticamente:', empError.message);
          // Não falha a operação principal, apenas loga o aviso
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('SDR criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar SDR: ${error.message}`);
    },
  });
};

// Update SDR
export const useUpdateSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sdr: Partial<Sdr> & { id: string }) => {
      const { id, ...updateData } = sdr;
      const { data, error } = await supabase
        .from('sdr')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs'] });
      toast.success('SDR atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar SDR: ${error.message}`);
    },
  });
};

// Approve SDR
export const useApproveSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sdrId, approve, userId }: { sdrId: string; approve: boolean; userId: string }) => {
      const { data, error } = await supabase
        .from('sdr')
        .update({
          status: approve ? 'APPROVED' : 'REJECTED',
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', sdrId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
      toast.success(variables.approve ? 'SDR aprovado' : 'SDR rejeitado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Create Comp Plan
export const useCreateCompPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: Omit<Partial<SdrCompPlan>, 'sdr_id' | 'vigencia_inicio'> & { sdr_id: string; vigencia_inicio: string }) => {
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .insert([plan as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-plans-all'] });
      toast.success('Plano OTE criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar plano: ${error.message}`);
    },
  });
};

// Update Comp Plan
export const useUpdateCompPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: Partial<SdrCompPlan> & { id: string }) => {
      const { id, ...updateData } = plan;
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['comp-plans-all'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plan'] });
      
      // Recalcular todos os payouts pendentes (DRAFT/APPROVED) do SDR
      try {
        const { data: pendingPayouts } = await supabase
          .from('sdr_month_payout')
          .select('ano_mes')
          .eq('sdr_id', data.sdr_id)
          .in('status', ['DRAFT', 'APPROVED']);

        const mesesRecalcular = pendingPayouts?.map(p => p.ano_mes) || [];
        
        // Adicionar mês atual se não estiver na lista
        const anoMesAtual = new Date().toISOString().slice(0, 7);
        if (!mesesRecalcular.includes(anoMesAtual)) {
          mesesRecalcular.push(anoMesAtual);
        }

        // Recalcular cada mês pendente
        for (const anoMes of mesesRecalcular) {
          await supabase.functions.invoke('recalculate-sdr-payout', {
            body: { sdr_id: data.sdr_id, ano_mes: anoMes }
          });
        }

        queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
        queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
        toast.success(`Plano OTE atualizado e ${mesesRecalcular.length} mês(es) recalculado(s)`);
      } catch (recalcError) {
        console.error('Erro ao recalcular payouts:', recalcError);
        toast.success('Plano OTE atualizado (recálculo pendente)');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar plano: ${error.message}`);
    },
  });
};

// Approve Comp Plan
export const useApproveCompPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, approve, userId }: { planId: string; approve: boolean; userId: string }) => {
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .update({
          status: approve ? 'active' : 'rejected',
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comp-plans-all'] });
      toast.success(variables.approve ? 'Plano aprovado' : 'Plano rejeitado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Fetch users for SDR assignment
export const useUsers = () => {
  return useQuery({
    queryKey: ['users-for-sdr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('email');
      
      if (error) throw error;
      return data;
    },
  });
};

// Fetch intermediacoes for an SDR/month
export const useSdrIntermediacoes = (sdrId: string | undefined, anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-intermediacoes', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId || !anoMes) return [];
      
      const { data, error } = await supabase
        .from('sdr_intermediacoes')
        .select(`
          *,
          hubla_transaction:hubla_transaction_id(customer_name, customer_email, product_name, product_price)
        `)
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!sdrId && !!anoMes,
  });
};

// Update KPI manually
export const useUpdateKpi = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kpiId, updates }: { kpiId: string; updates: Partial<SdrMonthKpi> }) => {
      const { data, error } = await supabase
        .from('sdr_month_kpi')
        .update(updates)
        .eq('id', kpiId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-month-kpi'] });
      toast.success('KPI atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Delete Comp Plan
export const useDeleteCompPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('sdr_comp_plan')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      return planId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-plans-all'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plan'] });
      toast.success('Plano OTE excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir plano: ${error.message}`);
    },
  });
};
