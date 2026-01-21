import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PurchaseHistoryItem {
  id: string;
  product_name: string;
  product_price: number;
  sale_date: string;
  sale_status: string;
}

export function useLeadPurchaseHistory(email: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-purchase-history', email],
    queryFn: async (): Promise<PurchaseHistoryItem[]> => {
      if (!email) return [];

      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, product_name, product_price, sale_date, sale_status')
        .eq('customer_email', email)
        .order('sale_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as PurchaseHistoryItem[];
    },
    enabled: !!email,
  });
}
