import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ultrameta {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClint: number;
  ultrametaLiquido: number;
}

export const useUltrameta = () => {
  return useQuery({
    queryKey: ['ultrameta'],
    queryFn: async () => {
      // Buscar última semana
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;

      return {
        ultrametaClint: data.ultrameta_clint || 0,
        faturamentoIncorporador50k: data.incorporador_50k || 0,
        faturamentoClint: data.clint_revenue || 0,
        ultrametaLiquido: data.ultrameta_liquido || 0,
      } as Ultrameta;
    },
  });
};
