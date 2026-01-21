import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface HublaTransaction {
  id: string;
  product_name: string | null;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  total_installments: number | null;
  source: string | null;
  gross_winner: boolean | null;
}

export interface TransactionFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

// Ajusta para timezone de Brasília (UTC-3)
const formatDateWithBrazilTimezone = (date: Date, endOfDay = false): string => {
  const formatted = format(date, 'yyyy-MM-dd');
  return endOfDay ? `${formatted}T23:59:59-03:00` : `${formatted}T00:00:00-03:00`;
};

export const useAllHublaTransactions = (filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['all-hubla-transactions', filters.search, filters.startDate?.toISOString(), filters.endDate?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_hubla_transactions', {
        p_search: filters.search || null,
        p_start_date: filters.startDate ? formatDateWithBrazilTimezone(filters.startDate) : null,
        p_end_date: filters.endDate ? formatDateWithBrazilTimezone(filters.endDate, true) : null,
        p_limit: 5000
      });
      
      if (error) throw error;
      return (data || []) as HublaTransaction[];
    },
    retry: 1,
    refetchInterval: (query) => {
      // Don't refetch if there was an error
      if (query.state.error) return false;
      return 30000;
    },
    staleTime: 10000,
  });
};
