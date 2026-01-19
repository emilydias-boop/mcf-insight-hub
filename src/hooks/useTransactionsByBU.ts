import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TransactionFilters, HublaTransaction } from './useAllHublaTransactions';

export const useTransactionsByBU = (targetBU: string, filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['transactions-by-bu', targetBU, filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hubla_transactions_by_bu', {
        p_target_bu: targetBU,
        p_search: filters.search || null,
        p_start_date: filters.startDate?.toISOString() || null,
        p_end_date: filters.endDate?.toISOString() || null,
        p_limit: 5000
      });

      if (error) {
        console.error('Error fetching transactions by BU:', error);
        throw error;
      }

      return (data || []) as HublaTransaction[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
