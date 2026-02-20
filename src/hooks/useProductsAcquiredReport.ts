import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductAcquiredReportItem {
  id: string;
  deal_id: string;
  deal_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  owner_id: string | null;
  produto_label: string;
  produto_name: string;
  valor: number;
  created_at: string;
}

interface UseProductsAcquiredReportParams {
  startDate?: Date;
  endDate?: Date;
}

export const useProductsAcquiredReport = ({ startDate, endDate }: UseProductsAcquiredReportParams) => {
  return useQuery({
    queryKey: ['products-acquired-report', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ProductAcquiredReportItem[]> => {
      let query = (supabase as any)
        .from('deal_produtos_adquiridos')
        .select(`
          id,
          deal_id,
          valor,
          created_at,
          consorcio_produto_adquirido_options(name, label),
          crm_deals!inner(name, owner_id, contact_id,
            crm_contacts(name, email, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        deal_id: item.deal_id,
        deal_name: item.crm_deals?.name || '',
        contact_name: item.crm_deals?.crm_contacts?.name || null,
        contact_email: item.crm_deals?.crm_contacts?.email || null,
        contact_phone: item.crm_deals?.crm_contacts?.phone || null,
        owner_id: item.crm_deals?.owner_id || null,
        produto_label: item.consorcio_produto_adquirido_options?.label || 'N/A',
        produto_name: item.consorcio_produto_adquirido_options?.name || '',
        valor: item.valor || 0,
        created_at: item.created_at,
      }));
    },
    enabled: !!startDate,
  });
};
