import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SyncAllResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    sdr_name: string;
    reunioes_agendadas: number;
    reunioes_realizadas: number;
    error?: string;
  }>;
}

export const useSyncAllSdrKpis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (anoMes?: string): Promise<SyncAllResult> => {
      const targetMonth = anoMes || format(new Date(), 'yyyy-MM');
      
      // Fetch all active SDRs
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('id, email, name')
        .eq('active', true);

      if (sdrsError) throw sdrsError;
      if (!sdrs || sdrs.length === 0) {
        return { total: 0, success: 0, failed: 0, results: [] };
      }

      const results: SyncAllResult['results'] = [];
      let success = 0;
      let failed = 0;

      // Sync each SDR sequentially to avoid rate limiting
      for (const sdr of sdrs) {
        try {
          const { data, error } = await supabase.functions.invoke('sync-sdr-kpis', {
            body: { sdr_id: sdr.id, ano_mes: targetMonth },
          });

          if (error) {
            results.push({ sdr_name: sdr.name, reunioes_agendadas: 0, reunioes_realizadas: 0, error: error.message });
            failed++;
          } else if (data.error) {
            results.push({ sdr_name: sdr.name, reunioes_agendadas: 0, reunioes_realizadas: 0, error: data.error });
            failed++;
          } else {
            results.push({
              sdr_name: sdr.name,
              reunioes_agendadas: data.stats?.reunioes_agendadas || 0,
              reunioes_realizadas: data.stats?.reunioes_realizadas || 0,
            });
            success++;
          }
        } catch (err: any) {
          results.push({ sdr_name: sdr.name, reunioes_agendadas: 0, reunioes_realizadas: 0, error: err.message });
          failed++;
        }
      }

      return { total: sdrs.length, success, failed, results };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-month-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-comparison'] });
      
      const totalAgendadas = data.results.reduce((sum, r) => sum + r.reunioes_agendadas, 0);
      toast.success(`KPIs sincronizados: ${data.success}/${data.total} SDRs (${totalAgendadas} R1 Agendadas)`);
    },
    onError: (error) => {
      console.error('Erro ao sincronizar todos os KPIs:', error);
      toast.error('Erro ao sincronizar KPIs');
    },
  });
};
