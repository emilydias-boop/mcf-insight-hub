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
}

/**
 * Hook to fetch unlinked contract transactions (product_category = 'contrato')
 * from the last 14 days that have no linked_attendee_id
 */
export function useUnlinkedContracts() {
  const twoWeeksAgo = subDays(new Date(), 14);

  return useQuery({
    queryKey: ['unlinked-contracts'],
    queryFn: async () => {
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
    refetchInterval: 60000, // 1 minuto
    staleTime: 10000,
  });
}
