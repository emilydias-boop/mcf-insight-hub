import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface UnlinkedContract {
  id: string;
  hubla_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  net_value: number | null;
  product_price: number | null;
  product_name?: string | null;
  product_category?: string | null;
}

interface UseUnlinkedContractsOptions {
  searchAll?: boolean;
  search?: string;
}

/**
 * Hook to fetch unlinked contract transactions.
 * Default: product_category = 'contrato', last 14 days.
 * searchAll mode: no date/category filter, server-side search (min 3 chars).
 */
export function useUnlinkedContracts(options: UseUnlinkedContractsOptions = {}) {
  const { searchAll = false, search = '' } = options;
  const twoWeeksAgo = subDays(new Date(), 14);
  const trimmedSearch = search.trim();

  return useQuery({
    queryKey: ['unlinked-contracts', searchAll, trimmedSearch],
    queryFn: async () => {
      if (searchAll) {
        // Expanded search: no date/category filter, server-side search required
        if (trimmedSearch.length < 3) return [] as UnlinkedContract[];

        const { data, error } = await supabase
          .from('hubla_transactions')
          .select('id, hubla_id, customer_name, customer_email, customer_phone, sale_date, net_value, product_price, product_name, product_category')
          .is('linked_attendee_id', null)
          .or(`customer_email.ilike.%${trimmedSearch}%,customer_name.ilike.%${trimmedSearch}%,customer_phone.ilike.%${trimmedSearch}%`)
          .order('sale_date', { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data || []) as UnlinkedContract[];
      }

      // Default: last 14 days, contrato only
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id, customer_name, customer_email, customer_phone, sale_date, net_value, product_price')
        .eq('product_category', 'contrato')
        .is('linked_attendee_id', null)
        .gte('sale_date', twoWeeksAgo.toISOString())
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return (data || []) as UnlinkedContract[];
    },
    refetchInterval: 60000,
    staleTime: 10000,
  });
}
