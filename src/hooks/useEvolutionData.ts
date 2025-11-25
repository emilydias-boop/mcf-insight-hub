import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionData } from '@/types/dashboard';

export const useEvolutionData = (limit: number = 12) => {
  return useQuery({
    queryKey: ['evolution-data', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: true })
        .limit(limit);
      
      if (error) throw error;

      // Transformar dados para formato do gráfico
      const evolutionData: EvolutionData[] = data.map((week) => ({
        periodo: week.week_label,
        semanaLabel: week.week_label,
        faturamento: week.total_revenue || 0,
        custos: week.operating_cost || 0,
        lucro: week.operating_profit || 0,
        roi: week.roi || 0,
        roas: week.roas || 0,
        vendasA010: week.a010_sales || 0,
        vendasContratos: week.contract_sales || 0,
        leads: week.stage_01_actual || 0,
      }));

      return evolutionData;
    },
  });
};
