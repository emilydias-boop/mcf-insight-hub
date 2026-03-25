import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLeadProfile(contactId: string | null | undefined, dealId?: string | null) {
  return useQuery({
    queryKey: ['lead-profile', contactId, dealId],
    queryFn: async () => {
      // Try contact_id first
      if (contactId) {
        const { data, error } = await supabase
          .from('lead_profiles')
          .select('*')
          .eq('contact_id', contactId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      // Fallback to deal_id
      if (dealId) {
        const { data, error } = await supabase
          .from('lead_profiles')
          .select('*')
          .eq('deal_id', dealId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      return null;
    },
    enabled: !!contactId || !!dealId,
  });
}
