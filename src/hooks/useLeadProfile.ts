import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLeadProfile(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-profile', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('lead_profiles')
        .select('*')
        .eq('contact_id', contactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}
