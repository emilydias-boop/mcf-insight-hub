import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FechamentoMetricaMes, METRICAS_DISPONIVEIS } from '@/types/sdr-fechamento';
import { toast } from 'sonner';

export const useFechamentoMetricas = (anoMes: string, cargoId?: string, squad?: string) => {
  return useQuery({
    queryKey: ['fechamento-metricas', anoMes, cargoId, squad],
    queryFn: async () => {
      let query = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', anoMes);
      
      // Tratar null vs undefined corretamente
      if (cargoId) {
        query = query.eq('cargo_catalogo_id', cargoId);
      } else {
        query = query.is('cargo_catalogo_id', null);
      }
      
      if (squad) {
        query = query.eq('squad', squad);
      } else {
        query = query.is('squad', null);
      }
      
      const { data, error } = await query.order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as FechamentoMetricaMes[];
    },
    enabled: !!anoMes,
  });
};

export const useUpsertMetrica = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metrica: Partial<FechamentoMetricaMes> & { 
      ano_mes: string; 
      nome_metrica: string;
      label_exibicao: string;
    }) => {
      const { data, error } = await supabase
        .from('fechamento_metricas_mes')
        .upsert(metrica, { 
          onConflict: 'ano_mes,cargo_catalogo_id,squad,nome_metrica',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
      toast.success('Métrica salva');
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
};

// Interface para o contexto de delete
interface DeleteConfig {
  anoMes: string;
  cargoId: string | null;
  squad: string | null;
}

interface MetricaToSave extends Partial<FechamentoMetricaMes> {
  ano_mes: string;
  nome_metrica: string;
  label_exibicao: string;
  _deleteConfig?: DeleteConfig;
}

export const useBulkUpsertMetricas = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metricas: MetricaToSave[]) => {
      // Extract delete config from first item
      const deleteConfig = metricas[0]?._deleteConfig;
      
      // Step 1: DELETE existing metrics for this cargo/squad/month
      if (deleteConfig) {
        let deleteQuery = supabase
          .from('fechamento_metricas_mes')
          .delete()
          .eq('ano_mes', deleteConfig.anoMes);
        
        if (deleteConfig.cargoId) {
          deleteQuery = deleteQuery.eq('cargo_catalogo_id', deleteConfig.cargoId);
        } else {
          deleteQuery = deleteQuery.is('cargo_catalogo_id', null);
        }
        
        if (deleteConfig.squad) {
          deleteQuery = deleteQuery.eq('squad', deleteConfig.squad);
        } else {
          deleteQuery = deleteQuery.is('squad', null);
        }
        
        const { error: deleteError } = await deleteQuery;
        if (deleteError) {
          console.error('Error deleting old metrics:', deleteError);
          throw deleteError;
        }
      }
      
      // Step 2: INSERT new active metrics (remove _deleteConfig from data)
      const cleanMetricas = metricas.map(({ _deleteConfig, ...rest }) => rest);
      
      if (cleanMetricas.length === 0) {
        // If no metrics to insert, just return empty (deletion already happened)
        return [];
      }
      
      const { data, error } = await supabase
        .from('fechamento_metricas_mes')
        .insert(cleanMetricas)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['active-metrics-for-cargo'] });
      queryClient.invalidateQueries({ queryKey: ['active-metrics-for-sdr'] });
      toast.success('Métricas salvas');
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
};

export const useDeleteMetrica = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fechamento_metricas_mes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
      toast.success('Métrica removida');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
};

// Helper para copiar métricas de um mês para outro
export const useCopyMetricasFromPreviousMonth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      fromAnoMes, 
      toAnoMes, 
      cargoId, 
      squad 
    }: { 
      fromAnoMes: string; 
      toAnoMes: string; 
      cargoId?: string; 
      squad?: string;
    }) => {
      // Buscar métricas do mês anterior
      let fetchQuery = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', fromAnoMes);
      
      if (cargoId) {
        fetchQuery = fetchQuery.eq('cargo_catalogo_id', cargoId);
      } else {
        fetchQuery = fetchQuery.is('cargo_catalogo_id', null);
      }
      
      if (squad) {
        fetchQuery = fetchQuery.eq('squad', squad);
      } else {
        fetchQuery = fetchQuery.is('squad', null);
      }
      
      const { data: oldMetrics, error: fetchError } = await fetchQuery;
      if (fetchError) throw fetchError;
      
      if (!oldMetrics || oldMetrics.length === 0) {
        throw new Error('Nenhuma métrica encontrada no mês anterior');
      }
      
      // Step 1: Delete existing metrics in target month
      let deleteQuery = supabase
        .from('fechamento_metricas_mes')
        .delete()
        .eq('ano_mes', toAnoMes);
      
      if (cargoId) {
        deleteQuery = deleteQuery.eq('cargo_catalogo_id', cargoId);
      } else {
        deleteQuery = deleteQuery.is('cargo_catalogo_id', null);
      }
      
      if (squad) {
        deleteQuery = deleteQuery.eq('squad', squad);
      } else {
        deleteQuery = deleteQuery.is('squad', null);
      }
      
      await deleteQuery;
      
      // Step 2: Insert copied metrics
      const newMetrics = oldMetrics.map(m => ({
        ano_mes: toAnoMes,
        cargo_catalogo_id: m.cargo_catalogo_id,
        squad: m.squad,
        nome_metrica: m.nome_metrica,
        label_exibicao: m.label_exibicao,
        peso_percentual: m.peso_percentual,
        meta_valor: m.meta_valor,
        fonte_dados: m.fonte_dados,
        ativo: m.ativo,
      }));
      
      const { data, error } = await supabase
        .from('fechamento_metricas_mes')
        .insert(newMetrics)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['active-metrics-for-cargo'] });
      queryClient.invalidateQueries({ queryKey: ['active-metrics-for-sdr'] });
      toast.success(`${data?.length || 0} métricas copiadas`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao copiar: ${error.message}`);
    },
  });
};

// Helper para obter métricas disponíveis
export const getMetricasDisponiveis = () => METRICAS_DISPONIVEIS;
