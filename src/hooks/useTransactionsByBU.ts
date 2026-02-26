import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { TransactionFilters, HublaTransaction } from './useAllHublaTransactions';

// Ajusta para timezone de Brasília (UTC-3) - consistente com useAllHublaTransactions
const formatDateWithBrazilTimezone = (date: Date, endOfDay = false): string => {
  const formatted = format(date, 'yyyy-MM-dd');
  return endOfDay ? `${formatted}T23:59:59-03:00` : `${formatted}T00:00:00-03:00`;
};

export const useTransactionsByBU = (targetBU: string, filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['transactions-by-bu', targetBU, filters.search, filters.startDate?.toISOString(), filters.endDate?.toISOString(), filters.selectedProducts],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hubla_transactions_by_bu', {
        p_bu: targetBU,
        p_search: filters.search || null,
        p_start_date: filters.startDate ? formatDateWithBrazilTimezone(filters.startDate) : null,
        p_end_date: filters.endDate ? formatDateWithBrazilTimezone(filters.endDate, true) : null,
        p_limit: 5000
      });

      if (error) {
        console.error('Error fetching transactions by BU:', error);
        throw error;
      }

      let results = (data || []) as unknown as HublaTransaction[];

      // Filtro client-side por produtos selecionados (RPC não suporta este parâmetro)
      if (filters.selectedProducts?.length) {
        results = results.filter(t =>
          filters.selectedProducts!.some(p =>
            t.product_name?.toLowerCase().includes(p.toLowerCase())
          )
        );
      }

      return results;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
