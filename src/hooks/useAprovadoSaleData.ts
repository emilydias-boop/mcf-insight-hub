import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export interface AprovadoSaleData {
  id: string;
  product_name: string;
  net_value: number;
  sale_date: string;
  customer_email: string | null;
  customer_phone: string | null;
}

export function useAprovadoSaleData(email: string | null, phone: string | null) {
  return useQuery({
    queryKey: ['aprovado-sale', email, phone],
    queryFn: async (): Promise<AprovadoSaleData | null> => {
      if (!email && !phone) return null;

      // Build OR conditions for email/phone match
      const conditions: string[] = [];
      
      if (email) {
        conditions.push(`customer_email.ilike.${email.toLowerCase()}`);
      }
      
      if (phone) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone.length >= 10) {
          // Match last 8-9 digits
          const phoneSuffix = normalizedPhone.slice(-9);
          conditions.push(`customer_phone.ilike.%${phoneSuffix}`);
        }
      }

      if (conditions.length === 0) return null;

      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, product_name, net_value, sale_date, customer_email, customer_phone')
        .eq('product_category', 'parceria')
        .eq('sale_status', 'paid')
        .or(conditions.join(','))
        .order('sale_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sale data:', error);
        return null;
      }

      return data;
    },
    enabled: !!(email || phone),
  });
}
