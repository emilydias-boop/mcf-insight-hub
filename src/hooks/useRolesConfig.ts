import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RoleConfig {
  id: string;
  role_key: string;
  label: string;
  color: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRolesConfig(onlyActive = false) {
  const query = useQuery({
    queryKey: ['roles-config', onlyActive],
    queryFn: async () => {
      let q = supabase
        .from('roles_config')
        .select('*')
        .order('is_system', { ascending: false })
        .order('label');

      if (onlyActive) {
        q = q.eq('is_active', true);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as RoleConfig[];
    },
  });

  // Derive maps for easy lookup
  const rolesMap = new Map<string, RoleConfig>();
  const roleLabels: Record<string, string> = {};
  const roleColors: Record<string, string> = {};

  query.data?.forEach((r) => {
    rolesMap.set(r.role_key, r);
    roleLabels[r.role_key] = r.label;
    roleColors[r.role_key] = r.color;
  });

  return {
    ...query,
    roles: query.data || [],
    rolesMap,
    roleLabels,
    roleColors,
  };
}
