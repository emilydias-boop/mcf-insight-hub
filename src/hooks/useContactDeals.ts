import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dealsDoContatoKey, fetchDealsDoContato } from './useDealsDoContato';

export const useContactDeals = (contactId: string | undefined, excludeDealId: string | undefined, dealName?: string) => {
  return useQuery({
    // Com contactId, reaproveita a mesma consulta usada pela linha do tempo.
    queryKey: contactId ? dealsDoContatoKey(contactId) : ['contact-deals', null, dealName],
    queryFn: async (): Promise<any[]> => {
      if (contactId) return fetchDealsDoContato(contactId);
      if (!dealName) return [];
      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id, name, created_at, owner_id, value, custom_fields,
          crm_origins(name),
          crm_stages(stage_name, color)
        `)
        .eq('name', dealName)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    select: (deals: any[]) => (excludeDealId ? deals.filter((d) => d.id !== excludeDealId) : deals),
    staleTime: 60000,
    enabled: !!contactId || !!dealName,
  });
};
