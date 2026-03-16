import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PurchaseHistoryItem {
  id: string;
  product_name: string;
  product_price: number;
  sale_date: string;
  sale_status: string;
  source: string | null;
}

export function useLeadPurchaseHistory(email: string | null | undefined, phone?: string | null) {
  // Extract 9-digit phone suffix for matching
  const phoneSuffix = phone ? phone.replace(/\D/g, '').slice(-9) : '';
  const hasPhone = phoneSuffix.length >= 8;
  const hasEmail = !!email;

  return useQuery({
    queryKey: ['lead-purchase-history', email, phoneSuffix],
    queryFn: async (): Promise<PurchaseHistoryItem[]> => {
      if (!hasEmail && !hasPhone) return [];

      let query = supabase
        .from('hubla_transactions')
        .select('id, product_name, product_price, sale_date, sale_status, source')
        .in('source', ['hubla', 'kiwify', 'manual', 'make']);

      if (hasEmail && hasPhone) {
        // Search by email OR phone suffix
        query = query.or(`customer_email.eq.${email},customer_phone.ilike.%${phoneSuffix}`);
      } else if (hasEmail) {
        query = query.eq('customer_email', email);
      } else {
        // Only phone
        query = query.ilike('customer_phone', `%${phoneSuffix}`);
      }

      const { data, error } = await query
        .order('sale_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as PurchaseHistoryItem[];
    },
    enabled: hasEmail || hasPhone,
  });
}
