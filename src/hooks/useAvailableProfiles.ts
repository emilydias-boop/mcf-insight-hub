import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableProfile {
  id: string;
  email: string;
  full_name: string | null;
  squad: string | null;
  access_status: string | null;
  role: string | null;
}

/**
 * Hook para buscar profiles disponíveis para vinculação com employees
 * Retorna profiles que ainda não estão vinculados a nenhum employee
 */
export function useAvailableProfiles() {
  return useQuery({
    queryKey: ['available-profiles'],
    queryFn: async () => {
      // Buscar profiles ativos com suas roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          squad,
          access_status
        `)
        .eq('access_status', 'ativo')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Buscar profiles que já estão vinculados a employees
      const { data: linkedEmployees, error: employeesError } = await supabase
        .from('employees')
        .select('profile_id')
        .not('profile_id', 'is', null);

      if (employeesError) throw employeesError;

      const linkedProfileIds = new Set(linkedEmployees?.map(e => e.profile_id) || []);

      // Buscar roles para cada profile
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string>();
      userRoles?.forEach(ur => {
        roleMap.set(ur.user_id, ur.role);
      });

      // Filtrar profiles não vinculados e adicionar role
      const availableProfiles: AvailableProfile[] = (profiles || [])
        .filter(p => !linkedProfileIds.has(p.id))
        .map(p => ({
          ...p,
          role: roleMap.get(p.id) || null,
        }));

      return availableProfiles;
    },
  });
}

/**
 * Hook para buscar um profile específico pelo ID
 */
export function useLinkedProfile(profileId: string | null) {
  return useQuery({
    queryKey: ['linked-profile', profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          squad,
          access_status
        `)
        .eq('id', profileId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return null;

      // Buscar role
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileId)
        .maybeSingle();

      if (roleError) throw roleError;

      return {
        ...profile,
        role: userRole?.role || null,
      } as AvailableProfile;
    },
    enabled: !!profileId,
  });
}
