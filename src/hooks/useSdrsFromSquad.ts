import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SdrFromSquad {
  id: string;
  name: string;
  email: string | null;
  role_type: string | null;
  meta_diaria: number | null;
}

/**
 * Hook to fetch active SDRs from a specific squad dynamically from the database.
 * This replaces hardcoded SDR_LIST for better HR sync.
 */
export function useSdrsFromSquad(squad: string) {
  return useQuery({
    queryKey: ['sdrs-squad', squad],
    queryFn: async (): Promise<SdrFromSquad[]> => {
      const { data, error } = await supabase
        .from('sdr')
        .select('id, name, email, role_type, meta_diaria')
        .eq('active', true)
        .eq('squad', squad)
        .eq('role_type', 'sdr')
        .order('name');
      
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Cross-check with profiles to exclude blocked/deactivated users
      const emails = data.map(s => s.email?.toLowerCase()).filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email, access_status')
        .in('email', emails);

      const blockedEmails = new Set(
        (profiles || [])
          .filter(p => p.access_status && p.access_status !== 'ativo')
          .map(p => p.email?.toLowerCase())
      );

      return data.filter(s => !blockedEmails.has(s.email?.toLowerCase() || ''));
    },
    staleTime: 60000,
  });
}
