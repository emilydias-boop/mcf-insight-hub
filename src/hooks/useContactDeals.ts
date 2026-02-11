import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useContactDeals = (contactId: string | undefined, excludeDealId: string | undefined) => {
  return useQuery({
    queryKey: ['contact-deals', contactId, excludeDealId],
    queryFn: async () => {
      if (!contactId) return [];
      
      let query = supabase
        .from('crm_deals')
        .select(`
          id, name, created_at, owner_id, value, custom_fields,
          crm_origins(name),
          crm_stages(stage_name, color)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      
      if (excludeDealId) {
        query = query.neq('id', excludeDealId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });
};
