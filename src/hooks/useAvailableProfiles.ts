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

      // Buscar roles para cada profile (pode ter múltiplas por usuário)
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Prioridade de roles: menor = maior prioridade
      const ROLE_PRIORITY: Record<string, number> = {
        admin: 1, manager: 2, coordenador: 3, closer: 4,
        closer_sombra: 5, financeiro: 6, rh: 7, sdr: 8, viewer: 9,
      };

      // Agrupar roles por user_id e escolher a de maior prioridade
      const rolesByUser = new Map<string, string[]>();
      userRoles?.forEach(ur => {
        const existing = rolesByUser.get(ur.user_id) || [];
        existing.push(ur.role);
        rolesByUser.set(ur.user_id, existing);
      });

      const roleMap = new Map<string, string>();
      rolesByUser.forEach((roles, userId) => {
        const sortedRoles = roles.sort((a, b) => 
          (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99)
        );
        roleMap.set(userId, sortedRoles[0]);
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

      // Buscar roles (pode ter múltiplas)
      const { data: userRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileId);

      if (roleError) throw roleError;

      // Determinar role principal por prioridade
      const ROLE_PRIORITY: Record<string, number> = {
        admin: 1, manager: 2, coordenador: 3, closer: 4,
        closer_sombra: 5, financeiro: 6, rh: 7, sdr: 8, viewer: 9,
      };

      const primaryRole = userRoles?.length 
        ? userRoles.sort((a, b) => 
            (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99)
          )[0].role 
        : null;

      return {
        ...profile,
        role: primaryRole,
      } as AvailableProfile;
    },
    enabled: !!profileId,
  });
}
