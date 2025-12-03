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
      if (!sdrId) return null;
      
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
    enabled: !!sdrId,
  });
};

// Fetch KPIs for an SDR/month
export const useSdrMonthKpi = (sdrId: string | undefined, anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-month-kpi', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId) return null;
      
      const { data, error } = await supabase
        .from('sdr_month_kpi')
        .select('*')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SdrMonthKpi | null;
    },
    enabled: !!sdrId,
  });
};

// Helper to transform DB result to typed payout
const transformPayout = (data: any): SdrPayoutWithDetails => ({
  ...data,
  ajustes_json: (data.ajustes_json as PayoutAdjustment[]) || [],
  status: data.status as PayoutStatus,
});

// Fetch all payouts for a month
export const useSdrPayouts = (anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-payouts', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(*)
        `)
        .eq('ano_mes', anoMes)
        .order('created_at');
      
      if (error) throw error;
      return (data || []).map(transformPayout);
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
          sdr:sdr_id(*)
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
          sdr:sdr_id(*)
        `)
        .eq('sdr_id', sdrData.id)
        .eq('ano_mes', anoMes)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? transformPayout(data) : null;
    },
  });
};

// Calculate payout values
const calculatePayoutValues = (
  compPlan: SdrCompPlan,
  kpi: SdrMonthKpi
) => {
  // Calculate percentages
  const pct_reunioes_agendadas = compPlan.meta_reunioes_agendadas > 0 
    ? (kpi.reunioes_agendadas / compPlan.meta_reunioes_agendadas) * 100 
    : 0;
  const pct_reunioes_realizadas = compPlan.meta_reunioes_realizadas > 0
    ? (kpi.reunioes_realizadas / compPlan.meta_reunioes_realizadas) * 100
    : 0;
  const pct_tentativas = compPlan.meta_tentativas > 0
    ? (kpi.tentativas_ligacoes / compPlan.meta_tentativas) * 100
    : 0;
  const pct_organizacao = compPlan.meta_organizacao > 0
    ? (kpi.score_organizacao / compPlan.meta_organizacao) * 100
    : 0;

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

      // Upsert payout
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .upsert({
          sdr_id: sdrId,
          ano_mes: anoMes,
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

          const { data } = await supabase
            .from('sdr_month_payout')
            .upsert({
              sdr_id: sdr.id,
              ano_mes: anoMes,
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
        campo: adjustment.campo,
        valor_novo: String(adjustment.valor),
        motivo: adjustment.motivo,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      toast.success('Ajuste adicionado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar ajuste: ${error.message}`);
    },
  });
};

// Fetch all SDRs (including inactive and pending for admin view)
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
    queryKey: ['all-comp-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select(`
          *,
          sdr:sdr_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as (SdrCompPlan & { sdr: { name: string } })[];
    },
  });
};

// Fetch users for linking to SDR
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

// Create SDR
export const useCreateSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      user_id, 
      active 
    }: { 
      name: string; 
      user_id: string | null; 
      active: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check user role to determine status
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = roleData?.role === 'admin';
      const status = isAdmin ? 'APPROVED' : 'PENDING';

      const { data, error } = await supabase
        .from('sdr')
        .insert({
          name,
          user_id,
          active,
          status,
          criado_por: user.id,
          aprovado_por: isAdmin ? user.id : null,
          aprovado_em: isAdmin ? new Date().toISOString() : null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdrs'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
      toast.success('SDR criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar SDR: ${error.message}`);
    },
  });
};

// Approve/Reject SDR
export const useApproveSdr = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sdrId, 
      approve, 
      userId 
    }: { 
      sdrId: string; 
      approve: boolean; 
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('sdr')
        .update({
          status: approve ? 'APPROVED' : 'REJECTED',
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq('id', sdrId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['sdrs'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs-all'] });
      toast.success(approve ? 'SDR aprovado' : 'SDR rejeitado');
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
    mutationFn: async (plan: Omit<SdrCompPlan, 'id' | 'status' | 'criado_por' | 'aprovado_por' | 'aprovado_em' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = roleData?.role === 'admin';
      const status = isAdmin ? 'APPROVED' : 'PENDING';

      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .insert({
          ...plan,
          status,
          criado_por: user.id,
          aprovado_por: isAdmin ? user.id : null,
          aprovado_em: isAdmin ? new Date().toISOString() : null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-comp-plans'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plan'] });
      toast.success('Plano OTE criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar plano: ${error.message}`);
    },
  });
};

// Approve/Reject Comp Plan
export const useApproveCompPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      planId, 
      approve, 
      userId 
    }: { 
      planId: string; 
      approve: boolean; 
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .update({
          status: approve ? 'APPROVED' : 'REJECTED',
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['all-comp-plans'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plan'] });
      toast.success(approve ? 'Plano aprovado' : 'Plano rejeitado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Recalculate payout via Edge Function
export const useRecalculatePayoutEdge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sdr_id, ano_mes }: { sdr_id?: string; ano_mes: string }) => {
      const { data, error } = await supabase.functions.invoke('recalculate-sdr-payout', {
        body: { sdr_id, ano_mes }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { ano_mes }) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts', ano_mes] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      toast.success('Fechamento recalculado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao recalcular: ${error.message}`);
    },
  });
};
