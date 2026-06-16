import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CallThresholds {
  id?: string;
  squad: string;
  ring_drop_max: number;
  voicemail_max: number;
  effective_max: number;
}

export const DEFAULT_THRESHOLDS: CallThresholds = {
  squad: 'default',
  ring_drop_max: 10,
  voicemail_max: 30,
  effective_max: 60,
};

/**
 * Busca a configuração de faixas para o squad. Faz fallback para 'default' e,
 * em último caso, para os valores hardcoded de DEFAULT_THRESHOLDS.
 */
export function useCallClassificationThresholds(squad: string = 'default') {
  return useQuery({
    queryKey: ['call-classification-thresholds', squad],
    queryFn: async (): Promise<CallThresholds> => {
      const { data } = await supabase
        .from('call_classification_thresholds')
        .select('*')
        .in('squad', [squad, 'default']);

      const bySquad = (data || []).find((r: any) => r.squad === squad);
      const byDefault = (data || []).find((r: any) => r.squad === 'default');
      const chosen = bySquad || byDefault;
      if (!chosen) return DEFAULT_THRESHOLDS;
      return {
        id: chosen.id,
        squad: chosen.squad,
        ring_drop_max: chosen.ring_drop_max,
        voicemail_max: chosen.voicemail_max,
        effective_max: chosen.effective_max,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllCallClassificationThresholds() {
  return useQuery({
    queryKey: ['call-classification-thresholds', 'all'],
    queryFn: async (): Promise<CallThresholds[]> => {
      const { data, error } = await supabase
        .from('call_classification_thresholds')
        .select('*')
        .order('squad');
      if (error) throw error;
      return (data || []) as CallThresholds[];
    },
  });
}

export function useUpsertCallThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CallThresholds) => {
      if (payload.ring_drop_max >= payload.voicemail_max || payload.voicemail_max >= payload.effective_max) {
        throw new Error('As faixas devem ser crescentes: ring drop < caixa postal < efetiva.');
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('call_classification_thresholds')
        .upsert(
          {
            squad: payload.squad,
            ring_drop_max: payload.ring_drop_max,
            voicemail_max: payload.voicemail_max,
            effective_max: payload.effective_max,
            updated_by: user?.id ?? null,
          },
          { onConflict: 'squad' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-classification-thresholds'] });
      qc.invalidateQueries({ queryKey: ['sdr-activity-metrics'] });
      toast.success('Faixas atualizadas');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao salvar faixas'),
  });
}

export function useDeleteCallThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (squad: string) => {
      if (squad === 'default') throw new Error('Não é possível remover o registro padrão.');
      const { error } = await supabase
        .from('call_classification_thresholds')
        .delete()
        .eq('squad', squad);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-classification-thresholds'] });
      qc.invalidateQueries({ queryKey: ['sdr-activity-metrics'] });
      toast.success('Faixa removida');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao remover'),
  });
}
