import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncKpisParams {
  sdr_id: string;
  ano_mes: string;
}

interface SyncKpisResponse {
  success: boolean;
  kpi: any;
  stats: {
    reunioes_agendadas: number;
    no_shows: number;
    reunioes_realizadas: number;
    taxa_no_show: number;
    total_activities: number;
  };
}

export const useSyncSdrKpis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncKpisParams): Promise<SyncKpisResponse> => {
      const { data, error } = await supabase.functions.invoke('sync-sdr-kpis', {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-month-kpi', variables.sdr_id, variables.ano_mes] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      toast.success(`KPIs sincronizados: ${data.stats.reunioes_agendadas} R1 Agendadas, ${data.stats.reunioes_realizadas} R1 Realizadas`);
    },
    onError: (error) => {
      console.error('Erro ao sincronizar KPIs:', error);
      toast.error('Erro ao sincronizar KPIs do Clint');
    },
  });
};
