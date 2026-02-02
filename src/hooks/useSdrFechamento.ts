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
  getMultiplier 
} from '@/types/sdr-fechamento';

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

// Mapeamento de squad para departamento RH
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
        
        // Filter by squad/BU - Use cascaded priority: departamento_vigente > employees.departamento > sdr.squad
        if (filters.squad && filters.squad !== 'all') {
          const expectedDept = SQUAD_TO_DEPT[filters.squad];
          result = result.filter(p => {
            // 1. Priority: Frozen department from payout (departamento_vigente)
            const frozenDept = (p as any).departamento_vigente;
            if (frozenDept) {
              return frozenDept === expectedDept;
            }
            
            // 2. Fallback: Current HR department
            const employee = (p as any).employee;
            if (employee?.departamento) {
              return employee.departamento === expectedDept;
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
      return transformPayout(data);
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

// Calculate payout values
const calculatePayoutValues = (
  compPlan: SdrCompPlan,
  kpi: SdrMonthKpi,
  sdrMetaDiaria?: number,
  diasUteisMes?: number
) => {
  // Dias úteis do mês (do calendário ou padrão)
  const diasUteisReal = diasUteisMes || compPlan.dias_uteis || 19;

  // Meta de agendadas = meta_diaria do SDR × dias úteis do mês
  const metaAgendadasAjustada = Math.round((sdrMetaDiaria || 0) * diasUteisReal);
  
  // Meta de Realizadas = 70% do que foi REALMENTE agendado
  const metaRealizadasAjustada = Math.round(kpi.reunioes_agendadas * 0.7);
  
  // Meta de Tentativas = 84/dia × dias úteis (meta fixa para todos)
  const metaTentativasAjustada = Math.round(META_TENTATIVAS_DIARIA * diasUteisReal);

  // Calculate percentages
  const pct_reunioes_agendadas = metaAgendadasAjustada > 0 
    ? (kpi.reunioes_agendadas / metaAgendadasAjustada) * 100 
    : 0;
  const pct_reunioes_realizadas = metaRealizadasAjustada > 0
    ? (kpi.reunioes_realizadas / metaRealizadasAjustada) * 100
    : 0;
  const pct_tentativas = metaTentativasAjustada > 0
    ? (kpi.tentativas_ligacoes / metaTentativasAjustada) * 100
    : 0;
  // Organização = meta fixa de 100%
  const pct_organizacao = (kpi.score_organizacao / META_ORGANIZACAO) * 100;

  // Get multipliers
  const mult_reunioes_agendadas = getMultiplier(pct_reunioes_agendadas);
  const mult_reunioes_realizadas = getMultiplier(pct_reunioes_realizadas);
  const mult_tentativas = getMultiplier(pct_tentativas);
  const mult_organizacao = getMultiplier(pct_organizacao);

  // Calculate values
  const valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
  const valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
  const valor_tentativas = compPlan.valor_tentativas * mult_tentativas;
  const valor_organizacao = compPlan.valor_organizacao * mult_organizacao;

  // Totals
  const valor_variavel_total = valor_reunioes_agendadas + valor_reunioes_realizadas + valor_tentativas + valor_organizacao;
  const valor_fixo = compPlan.fixo_valor;
  const total_conta = valor_fixo + valor_variavel_total;

  // iFood logic
  const pct_media_global = (pct_reunioes_agendadas + pct_reunioes_realizadas + pct_tentativas + pct_organizacao) / 4;
  const ifood_mensal = compPlan.ifood_mensal;
  const ifood_ultrameta = pct_media_global >= 100 ? compPlan.ifood_ultrameta : 0;
  const total_ifood = ifood_mensal + ifood_ultrameta;

  return {
    pct_reunioes_agendadas,
    pct_reunioes_realizadas,
    pct_tentativas,
    pct_organizacao,
    mult_reunioes_agendadas,
    mult_reunioes_realizadas,
    mult_tentativas,
    mult_organizacao,
    valor_reunioes_agendadas,
    valor_reunioes_realizadas,
    valor_tentativas,
    valor_organizacao,
    valor_variavel_total,
    valor_fixo,
    total_conta,
    ifood_mensal,
    ifood_ultrameta,
    total_ifood,
  };
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

      // Calculate values
      const calculatedValues = calculatePayoutValues(compPlan as SdrCompPlan, kpi as SdrMonthKpi);

      // Get employee linked to SDR to capture current department
      const { data: employeeData } = await supabase
        .from('employees')
        .select('departamento')
        .eq('sdr_id', sdrId)
        .maybeSingle();

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

// Recalculate all payouts for a month
export const useRecalculateAllPayouts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (anoMes: string) => {
      // Get all active SDRs
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('id')
        .eq('active', true);

      if (sdrsError) throw sdrsError;

      const results = [];
      for (const sdr of sdrs || []) {
        try {
          // Get comp plan
          const [year, month] = anoMes.split('-').map(Number);
          const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

          const { data: compPlan } = await supabase
            .from('sdr_comp_plan')
            .select('*')
            .eq('sdr_id', sdr.id)
            .lte('vigencia_inicio', monthStart)
            .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
            .order('vigencia_inicio', { ascending: false })
            .limit(1)
            .single();

          if (!compPlan) continue;

          // Get or create KPI
          let { data: kpi } = await supabase
            .from('sdr_month_kpi')
            .select('*')
            .eq('sdr_id', sdr.id)
            .eq('ano_mes', anoMes)
            .single();

          if (!kpi) {
            const { data: newKpi } = await supabase
              .from('sdr_month_kpi')
              .insert({ sdr_id: sdr.id, ano_mes: anoMes })
              .select()
              .single();
            kpi = newKpi;
          }

          if (!kpi) continue;

          const calculatedValues = calculatePayoutValues(compPlan as SdrCompPlan, kpi as SdrMonthKpi);

          // Get employee linked to SDR to capture current department
          const { data: employeeData } = await supabase
            .from('employees')
            .select('departamento')
            .eq('sdr_id', sdr.id)
            .maybeSingle();

          const { data } = await supabase
            .from('sdr_month_payout')
            .upsert({
              sdr_id: sdr.id,
              ano_mes: anoMes,
              departamento_vigente: employeeData?.departamento || null,
              ...calculatedValues,
              status: 'DRAFT',
            }, {
              onConflict: 'sdr_id,ano_mes',
            })
            .select()
            .single();

          results.push(data);
        } catch (e) {
          console.error(`Error processing SDR ${sdr.id}:`, e);
        }
      }

      return results;
    },
    onSuccess: (_, anoMes) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts', anoMes] });
      toast.success('Todos os fechamentos recalculados');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao recalcular: ${error.message}`);
    },
  });
};

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

// Create SDR
export const useCreateSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sdr: Omit<Partial<Sdr>, 'name'> & { name: string }) => {
      const { data, error } = await supabase
        .from('sdr')
        .insert([sdr as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
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
