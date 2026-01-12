import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerTransaction {
  id: string;
  hubla_id: string | null;
  product_name: string;
  sale_date: string;
  product_price: number | null;
  net_value: number | null;
  installment_number: number | null;
  total_installments: number | null;
  count_in_dashboard: boolean | null;
  source: string | null;
}

export const useCustomerTransactions = (customerEmail: string | null) => {
  return useQuery({
    queryKey: ['customer-transactions', customerEmail],
    queryFn: async () => {
      if (!customerEmail) return [];
      
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id, product_name, sale_date, product_price, net_value, installment_number, total_installments, count_in_dashboard, source')
        .eq('customer_email', customerEmail)
        .eq('sale_status', 'completed')
        .eq('source', 'hubla')
        .neq('net_value', 0)
        .order('sale_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching customer transactions:', error);
        return [];
      }
      
      return (data || []) as CustomerTransaction[];
    },
    enabled: !!customerEmail
  });
};
