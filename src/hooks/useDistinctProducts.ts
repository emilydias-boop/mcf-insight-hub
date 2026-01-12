import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DistinctProduct {
  product_name: string;
  transaction_count: number;
}

export const useDistinctProducts = () => {
  return useQuery({
    queryKey: ['distinct-products'],
    queryFn: async (): Promise<DistinctProduct[]> => {
      const { data, error } = await supabase.rpc('get_distinct_products');

      if (error) throw error;
      return (data || []) as DistinctProduct[];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};
