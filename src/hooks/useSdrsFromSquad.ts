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
        .select('id, email, access_status')
        .in('email', emails);

      const blockedEmails = new Set(
        (profiles || [])
          .filter(p => p.access_status && p.access_status !== 'ativo')
          .map(p => p.email?.toLowerCase())
      );

      // Cross-check with user_roles to exclude admin/manager/coordenador
      const profileIds = (profiles || []).map(p => p.id).filter(Boolean);
      const adminEmails = new Set<string>();
      if (profileIds.length > 0) {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('user_id', profileIds)
          .in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo', 'closer', 'closer_sombra']);

        const adminProfileIds = new Set((adminRoles || []).map(r => r.user_id));
        (profiles || []).forEach(p => {
          if (adminProfileIds.has(p.id)) {
            adminEmails.add(p.email?.toLowerCase() || '');
          }
        });
      }

      return data.filter(s => {
        const email = s.email?.toLowerCase() || '';
        return !blockedEmails.has(email) && !adminEmails.has(email);
      });
    },
    staleTime: 60000,
  });
}
