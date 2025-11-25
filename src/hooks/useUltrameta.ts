import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ultrameta {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClintBruto: number;
  ultrametaLiquido: number;
}

export const useUltrameta = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['ultrameta', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      // Buscar semanas no período
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (startDate) {
        query = query.gte('start_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        query = query.lte('end_date', endDate.toISOString().split('T')[0]);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          ultrametaClint: 0,
          faturamentoIncorporador50k: 0,
          faturamentoClintBruto: 0,
          ultrametaLiquido: 0,
        } as Ultrameta;
      }

      // Agregar dados do período
      const totals = data.reduce((acc, week) => ({
        ultrametaClint: acc.ultrametaClint + (week.ultrameta_clint || 0),
        faturamentoIncorporador50k: acc.faturamentoIncorporador50k + (week.incorporador_50k || 0),
        faturamentoClintBruto: acc.faturamentoClintBruto + (week.clint_revenue || 0),
        ultrametaLiquido: acc.ultrametaLiquido + (week.ultrameta_liquido || 0),
      }), {
        ultrametaClint: 0,
        faturamentoIncorporador50k: 0,
        faturamentoClintBruto: 0,
        ultrametaLiquido: 0,
      });

      return totals as Ultrameta;
    },
  });
};
