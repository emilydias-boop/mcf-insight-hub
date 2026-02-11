import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useContactDeals = (contactId: string | undefined, excludeDealId: string | undefined, dealName?: string) => {
  return useQuery({
    queryKey: ['contact-deals', contactId, excludeDealId, dealName],
    queryFn: async () => {
      const selectFields = `
        id, name, created_at, owner_id, value, custom_fields,
        crm_origins(name),
        crm_stages(stage_name, color)
      `;

      let query;

      if (contactId) {
        query = supabase
          .from('crm_deals')
          .select(selectFields)
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false });
      } else if (dealName) {
        query = supabase
          .from('crm_deals')
          .select(selectFields)
          .eq('name', dealName)
          .order('created_at', { ascending: false });
      } else {
        return [];
      }

      if (excludeDealId) {
        query = query.neq('id', excludeDealId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId || !!dealName,
  });
};
