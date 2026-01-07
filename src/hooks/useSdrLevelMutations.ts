import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SdrLevelFull {
  level: number;
  fixo_valor: number;
  description: string | null;
  ote_total: number;
  variavel_total: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  dias_uteis: number;
  meta_no_show_pct: number;
  updated_at: string;
}

// Fetch all SDR levels with full data
export const useSdrLevels = () => {
  return useQuery({
    queryKey: ['sdr-levels-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_levels')
        .select('*')
        .order('level');
      
      if (error) throw error;
      return data as SdrLevelFull[];
    },
  });
};

// Count SDRs by level
export const useSdrsByLevel = () => {
  return useQuery({
    queryKey: ['sdrs-by-level'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('nivel')
        .eq('active', true);
      
      if (error) throw error;
      
      // Count SDRs per level
      const counts: Record<number, number> = {};
      data?.forEach((sdr) => {
        counts[sdr.nivel] = (counts[sdr.nivel] || 0) + 1;
      });
      
      return counts;
    },
  });
};

// Update a level's default values
export const useUpdateSdrLevel = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ level, data }: { level: number; data: Partial<SdrLevelFull> }) => {
      const { error } = await supabase
        .from('sdr_levels')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('level', level);
      
      if (error) throw error;
      return { level };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-levels-full'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-levels'] });
    },
  });
};

// Bulk apply level values to all comp plans of SDRs in that level
export const useBulkApplyLevelToCompPlans = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (nivel: number) => {
      // 1. Get level data
      const { data: levelData, error: levelError } = await supabase
        .from('sdr_levels')
        .select('*')
        .eq('level', nivel)
        .single();
      
      if (levelError) throw levelError;
      
      // 2. Get all active SDRs of this level
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('id, name')
        .eq('nivel', nivel)
        .eq('active', true);
      
      if (sdrsError) throw sdrsError;
      if (!sdrs || sdrs.length === 0) {
        return { updated: 0, recalculated: 0, sdrIds: [] };
      }
      
      // 3. Update all active comp plans for these SDRs
      let updated = 0;
      const sdrIds: string[] = [];
      for (const sdr of sdrs) {
        const { error: updateError } = await supabase
          .from('sdr_comp_plan')
          .update({
            fixo_valor: levelData.fixo_valor,
            ote_total: levelData.ote_total,
            variavel_total: levelData.variavel_total,
            valor_meta_rpg: levelData.valor_meta_rpg,
            valor_docs_reuniao: levelData.valor_docs_reuniao,
            valor_tentativas: levelData.valor_tentativas,
            valor_organizacao: levelData.valor_organizacao,
            meta_reunioes_agendadas: levelData.meta_reunioes_agendadas,
            meta_reunioes_realizadas: levelData.meta_reunioes_realizadas,
            meta_tentativas: levelData.meta_tentativas,
            meta_organizacao: levelData.meta_organizacao,
            ifood_mensal: levelData.ifood_mensal,
            ifood_ultrameta: levelData.ifood_ultrameta,
            dias_uteis: levelData.dias_uteis,
            meta_no_show_pct: levelData.meta_no_show_pct,
            updated_at: new Date().toISOString(),
          })
          .eq('sdr_id', sdr.id)
          .is('vigencia_fim', null); // Only active plans
        
        if (!updateError) {
          updated++;
          sdrIds.push(sdr.id);
        }
      }
      
      // 4. Recalculate payouts for current month for all affected SDRs
      const now = new Date();
      const anoMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let recalculated = 0;
      for (const sdrId of sdrIds) {
        try {
          const { error: recalcError } = await supabase.functions.invoke('recalculate-sdr-payout', {
            body: { sdr_id: sdrId, ano_mes: anoMes },
          });
          if (!recalcError) recalculated++;
        } catch (e) {
          console.error(`Erro ao recalcular payout para SDR ${sdrId}:`, e);
        }
      }
      
      return { updated, recalculated, sdrIds };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plans'] });
      queryClient.invalidateQueries({ queryKey: ['all-comp-plans'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      if (result.recalculated > 0) {
        toast.success(`Valores aplicados e ${result.recalculated} payouts recalculados`);
      }
    },
    onError: (error) => {
      console.error('Bulk apply error:', error);
      toast.error('Erro ao aplicar valores em massa');
    },
  });
};

// Recalculate all payouts for a specific month
export const useRecalculateMonth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (anoMes: string) => {
      const { data, error } = await supabase.functions.invoke('recalculate-sdr-payout', {
        body: { ano_mes: anoMes },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sdr-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-kpi'] });
      toast.success(`${data?.processed || 0} payouts recalculados`);
    },
    onError: (error) => {
      console.error('Recalculate month error:', error);
      toast.error('Erro ao recalcular payouts');
    },
  });
};
