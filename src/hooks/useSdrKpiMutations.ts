import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SdrMonthKpi, SdrIntermediacao, SdrLevel } from '@/types/sdr-fechamento';

// Fetch SDR Levels
export const useSdrLevels = () => {
  return useQuery({
    queryKey: ['sdr-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_levels')
        .select('*')
        .order('level');
      
      if (error) throw error;
      return data as SdrLevel[];
    },
  });
};

// Update or Create KPI
export const useUpsertSdrKpi = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kpiData: Partial<SdrMonthKpi> & { sdr_id: string; ano_mes: string }) => {
      // Check if KPI exists
      const { data: existing } = await supabase
        .from('sdr_month_kpi')
        .select('id')
        .eq('sdr_id', kpiData.sdr_id)
        .eq('ano_mes', kpiData.ano_mes)
        .single();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('sdr_month_kpi')
          .update(kpiData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('sdr_month_kpi')
          .insert(kpiData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-month-kpi', variables.sdr_id, variables.ano_mes] });
      toast.success('KPIs atualizados com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar KPIs: ${error.message}`);
    },
  });
};

// Fetch Intermediações
export const useSdrIntermediacoes = (sdrId: string | undefined, anoMes: string) => {
  return useQuery({
    queryKey: ['sdr-intermediacoes', sdrId, anoMes],
    queryFn: async () => {
      if (!sdrId) return [];
      
      const { data, error } = await supabase
        .from('sdr_intermediacoes')
        .select('*')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SdrIntermediacao[];
    },
    enabled: !!sdrId,
  });
};

// Add Intermediação
export const useAddIntermediacao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sdr_id: string;
      ano_mes: string;
      hubla_transaction_id?: string;
      produto_nome?: string;
      valor_venda?: number;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('sdr_intermediacoes')
        .insert({
          ...data,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-intermediacoes', variables.sdr_id, variables.ano_mes] });
      toast.success('Intermediação adicionada');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Delete Intermediação
export const useDeleteIntermediacao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sdrId, anoMes }: { id: string; sdrId: string; anoMes: string }) => {
      const { error } = await supabase
        .from('sdr_intermediacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { sdrId, anoMes };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-intermediacoes', data.sdrId, data.anoMes] });
      toast.success('Intermediação removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Authorize iFood Ultrameta
export const useAuthorizeUltrameta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payoutId, authorize }: { payoutId: string; authorize: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .update({
          ifood_ultrameta_autorizado: authorize,
          ifood_ultrameta_autorizado_por: authorize ? user.id : null,
          ifood_ultrameta_autorizado_em: authorize ? new Date().toISOString() : null,
        })
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      // Log the authorization
      await supabase.from('sdr_payout_audit_log').insert({
        payout_id: payoutId,
        user_id: user.id,
        campo: 'ifood_ultrameta_autorizado',
        valor_novo: authorize ? 'true' : 'false',
        motivo: authorize ? 'iFood Ultrameta autorizado' : 'Autorização iFood Ultrameta removida',
      });

      return data;
    },
    onSuccess: (_, { authorize }) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      toast.success(authorize ? 'iFood Ultrameta autorizado' : 'Autorização removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};

// Recalculate Payout and KPI together
export const useRecalculateWithKpi = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sdrId, anoMes, kpiData }: { 
      sdrId: string; 
      anoMes: string; 
      kpiData: Partial<SdrMonthKpi>;
    }) => {
      // First, update KPI
      const { data: existing } = await supabase
        .from('sdr_month_kpi')
        .select('id')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .single();

      if (existing) {
        await supabase
          .from('sdr_month_kpi')
          .update(kpiData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('sdr_month_kpi')
          .insert({ sdr_id: sdrId, ano_mes: anoMes, ...kpiData });
      }

      // Then recalculate payout via edge function
      const { data, error } = await supabase.functions.invoke('recalculate-sdr-payout', {
        body: { sdr_id: sdrId, ano_mes: anoMes }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sdrId, anoMes }) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-month-kpi', sdrId, anoMes] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payout-detail'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts', anoMes] });
      toast.success('KPIs salvos e payout recalculado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
};
