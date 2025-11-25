import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FunnelStage {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
}

export const useFunnelData = () => {
  return useQuery({
    queryKey: ['funnel-data'],
    queryFn: async () => {
      // Buscar última semana
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;

      // Montar dados do funil
      const funnelStages: FunnelStage[] = [];
      
      for (let i = 1; i <= 8; i++) {
        const stageNum = String(i).padStart(2, '0');
        const actual = data[`stage_${stageNum}_actual`] || 0;
        const rate = data[`stage_${stageNum}_rate`] || 0;
        const target = data[`stage_${stageNum}_target`] || 0;

        funnelStages.push({
          etapa: `Etapa ${stageNum}`,
          leads: actual,
          conversao: rate,
          meta: target,
        });
      }

      return funnelStages;
    },
  });
};

export const useA010Funnel = () => {
  const { data: stages } = useFunnelData();
  
  return {
    titulo: 'Funil A010',
    etapas: stages || [],
  };
};
