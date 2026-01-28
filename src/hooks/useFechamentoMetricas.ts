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
      
      if (cargoId) {
        query = query.eq('cargo_catalogo_id', cargoId);
      }
      
      if (squad) {
        query = query.eq('squad', squad);
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

export const useBulkUpsertMetricas = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metricas: Array<Partial<FechamentoMetricaMes> & { 
      ano_mes: string; 
      nome_metrica: string;
      label_exibicao: string;
    }>) => {
      const { data, error } = await supabase
        .from('fechamento_metricas_mes')
        .upsert(metricas, { 
          onConflict: 'ano_mes,cargo_catalogo_id,squad,nome_metrica',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
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
      let query = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', fromAnoMes);
      
      if (cargoId) query = query.eq('cargo_catalogo_id', cargoId);
      if (squad) query = query.eq('squad', squad);
      
      const { data: oldMetrics, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      if (!oldMetrics || oldMetrics.length === 0) {
        throw new Error('Nenhuma métrica encontrada no mês anterior');
      }
      
      // Criar novas métricas para o mês destino
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
        .upsert(newMetrics, { 
          onConflict: 'ano_mes,cargo_catalogo_id,squad,nome_metrica',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-metricas'] });
      toast.success(`${data?.length || 0} métricas copiadas`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao copiar: ${error.message}`);
    },
  });
};

// Helper para obter métricas disponíveis
export const getMetricasDisponiveis = () => METRICAS_DISPONIVEIS;
