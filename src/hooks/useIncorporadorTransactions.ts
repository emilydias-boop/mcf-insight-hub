import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncorporadorTransactionFilters {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  onlyCountInDashboard?: boolean;
}

export interface IncorporadorTransaction {
  id: string;
  hubla_id: string;
  product_name: string;
  product_category: string | null;
  product_price: number;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  sale_status: string;
  installment_number: number | null;
  total_installments: number | null;
  is_offer: boolean | null;
  count_in_dashboard: boolean | null;
  raw_data: Record<string, any> | null;
  source: string | null;
}

export const useIncorporadorTransactions = (filters: IncorporadorTransactionFilters) => {
  return useQuery({
    queryKey: ['incorporador-transactions', filters.search, filters.onlyCountInDashboard],
    queryFn: async (): Promise<IncorporadorTransaction[]> => {
      // Usar função RPC que filtra no servidor (bypassa limite de 1000 linhas)
      const { data, error } = await supabase.rpc('get_incorporador_transactions', {
        p_search: filters.search || null,
        p_limit: 10000
      });

      if (error) throw error;

      let result = (data || []) as IncorporadorTransaction[];

      // Filtro adicional de count_in_dashboard se necessário
      if (filters.onlyCountInDashboard) {
        result = result.filter(tx => tx.count_in_dashboard === true);
      }

      return result;
    },
    refetchInterval: 30000,
  });
};
