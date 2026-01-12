import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncorporadorTransactionFilters {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  onlyCountInDashboard?: boolean;
  selectedProducts?: string[];
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
    queryKey: [
      'incorporador-transactions', 
      filters.search, 
      filters.startDate?.toISOString(), 
      filters.endDate?.toISOString(), 
      filters.onlyCountInDashboard,
      filters.selectedProducts,
    ],
    queryFn: async (): Promise<IncorporadorTransaction[]> => {
      // Formatar datas em formato local para evitar problemas de timezone
      const formatLocalDate = (date: Date, endOfDay = false) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return endOfDay 
          ? `${year}-${month}-${day}T23:59:59`
          : `${year}-${month}-${day}T00:00:00`;
      };

      // Usar função RPC que filtra no servidor (bypassa limite de 1000 linhas)
      const { data, error } = await supabase.rpc('get_incorporador_transactions', {
        p_search: filters.search || null,
        p_start_date: filters.startDate ? formatLocalDate(filters.startDate) : null,
        p_end_date: filters.endDate ? formatLocalDate(filters.endDate, true) : null,
        p_products: filters.selectedProducts?.length ? filters.selectedProducts : null,
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
