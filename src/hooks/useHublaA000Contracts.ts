import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface HublaA000Transaction {
  id: string;
  saleDate: string;
  productName: string;
  netValue: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  source: string;
  installmentNumber: number | null;
  installmentsQuantity: number | null;
}

export interface HublaA000Filters {
  startDate: Date;
  endDate: Date;
}

export const useHublaA000Contracts = (filters: HublaA000Filters) => {
  return useQuery({
    queryKey: ['hubla-a000-contracts', filters],
    queryFn: async (): Promise<HublaA000Transaction[]> => {
      const startISO = format(filters.startDate, 'yyyy-MM-dd');
      const endISO = format(filters.endDate, 'yyyy-MM-dd');
      
      // Query hubla_transactions for A000 products (contract payments)
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select(`
          id,
          sale_date,
          product_name,
          net_value,
          customer_name,
          customer_email,
          customer_phone,
          source,
          installment_number,
          installments_quantity
        `)
        .eq('sale_status', 'paid')
        .gte('sale_date', startISO)
        .lte('sale_date', endISO)
        .or('product_name.ilike.%a000%,product_name.ilike.%contrato%')
        .order('sale_date', { ascending: false });
      
      if (error) throw error;
      
      if (!data) return [];
      
      // Transform to typed format
      return data.map((row: any) => ({
        id: row.id,
        saleDate: row.sale_date,
        productName: row.product_name || 'A000',
        netValue: row.net_value || 0,
        customerName: row.customer_name || 'N/A',
        customerEmail: row.customer_email || null,
        customerPhone: row.customer_phone || null,
        source: row.source || 'hubla',
        installmentNumber: row.installment_number || null,
        installmentsQuantity: row.installments_quantity || null,
      }));
    },
    enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
    staleTime: 2 * 60 * 1000,
  });
};

// Helper to normalize phone for matching (last 9 digits)
export const normalizePhoneForMatch = (phone: string | null): string => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return clean.slice(-9);
};

// Helper to normalize email for matching
export const normalizeEmailForMatch = (email: string | null): string => {
  if (!email) return '';
  return email.toLowerCase().trim();
};
