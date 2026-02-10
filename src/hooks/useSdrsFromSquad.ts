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
        .eq('role_type', 'sdr')  // Only SDRs, not closers
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000, // Cache for 1 minute
  });
}
