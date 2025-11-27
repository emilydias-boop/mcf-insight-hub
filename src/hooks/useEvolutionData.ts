import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionData } from '@/types/dashboard';
import { getCustomWeekStart, addCustomWeeks, formatDateForDB } from '@/lib/dateHelpers';

export const useEvolutionData = (canal?: string, limit: number = 52) => {
  return useQuery({
    queryKey: ['evolution-data', canal, limit],
    queryFn: async () => {
      // Calcular semana atual e início do range
      const semanaAtual = getCustomWeekStart(new Date());
      const semanaInicio = addCustomWeeks(semanaAtual, -(limit - 1)); // X semanas atrás
      
      const startDate = formatDateForDB(semanaInicio);
      const endDate = formatDateForDB(semanaAtual);
      
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .gte('start_date', startDate)  // >= semana início
        .lte('start_date', endDate)    // <= semana atual
        .order('start_date', { ascending: true }); // Ordem cronológica
      
      if (error) throw error;

      // Transformar dados para formato do gráfico
      const evolutionData: EvolutionData[] = data.map((week) => {
        let faturamento = week.total_revenue || 0;
        let vendas = (week.a010_sales || 0) + (week.contract_sales || 0);
        
        if (canal === 'a010') {
          faturamento = week.a010_revenue || 0;
          vendas = week.a010_sales || 0;
        } else if (canal === 'contratos') {
          faturamento = week.contract_revenue || 0;
          vendas = week.contract_sales || 0;
        } else if (canal === 'instagram') {
          faturamento = 0; // Instagram não tem revenue direto
          vendas = 0;
        }
        
        return {
          periodo: week.week_label,
          semanaLabel: week.week_label,
          faturamento,
          custos: week.operating_cost || 0,
          lucro: week.operating_profit || 0,
          roi: week.roi || 0,
          roas: week.roas || 0,
          vendasA010: week.a010_sales || 0,
          vendasContratos: week.contract_sales || 0,
          leads: week.stage_01_actual || 0,
        };
      });

      return evolutionData;
    },
  });
};
