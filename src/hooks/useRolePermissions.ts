import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel, AppRole } from '@/types/user-management';

interface RolePermission {
  id: string;
  role: string;
  resource: string;
  permission_level: string;
  bu: string | null;
}

// Map: { role: { resource: permission_level } } — for a specific BU context
type PermissionsMap = Record<string, Record<string, PermissionLevel>>;

export const useRolePermissions = (buFilter?: string | null) => {
  const queryClient = useQueryClient();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions-all', buFilter],
    queryFn: async () => {
      let query = supabase
        .from('role_permissions')
        .select('*');
      
      if (buFilter === undefined || buFilter === null) {
        // Global: bu IS NULL
        query = query.is('bu', null);
      } else {
        // Specific BU
        query = query.eq('bu', buFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const permissionsMap: PermissionsMap = permissions.reduce((acc, perm) => {
    if (!acc[perm.role]) {
      acc[perm.role] = {};
    }
    acc[perm.role][perm.resource] = perm.permission_level as PermissionLevel;
    return acc;
  }, {} as PermissionsMap);

  const updatePermission = useMutation({
    mutationFn: async ({ 
      role, 
      resource, 
      permissionLevel,
      bu,
    }: { 
      role: string; 
      resource: string; 
      permissionLevel: PermissionLevel;
      bu?: string | null;
    }) => {
      const record: any = {
        role,
        resource,
        permission_level: permissionLevel,
        bu: bu ?? null,
      };
      
      const { error } = await supabase
        .from('role_permissions')
        .upsert(record, {
          onConflict: 'role,resource,bu'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });

  const updatePermissions = useMutation({
    mutationFn: async (updates: { role: string; resource: string; permissionLevel: PermissionLevel; bu?: string | null }[]) => {
      const records = updates.map(u => ({
        role: u.role,
        resource: u.resource,
        permission_level: u.permissionLevel,
        bu: u.bu ?? null,
      }));

      // Upsert using the new unique index (role, resource, COALESCE(bu, '__global__'))
      // We need to do individual upserts because the onConflict doesn't support COALESCE
      for (const record of records) {
        // Check if exists
        let query = supabase
          .from('role_permissions')
          .select('id')
          .eq('role', record.role)
          .eq('resource', record.resource);
        
        if (record.bu === null) {
          query = query.is('bu', null);
        } else {
          query = query.eq('bu', record.bu);
        }
        
        const { data: existing } = await query.maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from('role_permissions')
            .update({ permission_level: record.permission_level })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('role_permissions')
            .insert(record);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });

  const getPermission = (role: AppRole, resource: ResourceType): PermissionLevel => {
    return permissionsMap[role]?.[resource] || 'none';
  };

  // Query to fetch ALL role_permissions (across all BUs) — used for override indicators
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['role-permissions-all-bus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, resource, bu');
      if (error) throw error;
      return (data || []) as { role: string; resource: string; bu: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Set of "role:resource" combos that have BU-specific overrides
  const buOverrides = new Set(
    allPermissions
      .filter(p => p.bu !== null)
      .map(p => `${p.role}:${p.resource}`)
  );

  const hasOverride = (role: string, resource: string): boolean => {
    return buOverrides.has(`${role}:${resource}`);
  };

  // Check if a specific resource has ANY BU override (any role)
  const resourceHasOverride = (resource: string): boolean => {
    return allPermissions.some(p => p.bu !== null && p.resource === resource);
  };

  return {
    permissions,
    permissionsMap,
    isLoading,
    updatePermission,
    updatePermissions,
    getPermission,
    hasOverride,
    resourceHasOverride,
  };
};
