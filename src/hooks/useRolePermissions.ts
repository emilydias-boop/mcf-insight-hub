import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel, AppRole } from '@/types/user-management';

interface RolePermission {
  id: string;
  role: string;
  resource: string;
  permission_level: string;
}

type PermissionsMap = Record<string, Record<string, PermissionLevel>>;

export const useRolePermissions = () => {
  const queryClient = useQueryClient();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Organize permissions as a map: { role: { resource: permission_level } }
  const permissionsMap: PermissionsMap = permissions.reduce((acc, perm) => {
    if (!acc[perm.role]) {
      acc[perm.role] = {};
    }
    acc[perm.role][perm.resource] = perm.permission_level as PermissionLevel;
    return acc;
  }, {} as PermissionsMap);

  // Mutation to update a permission
  const updatePermission = useMutation({
    mutationFn: async ({ 
      role, 
      resource, 
      permissionLevel 
    }: { 
      role: string; 
      resource: string; 
      permissionLevel: PermissionLevel 
    }) => {
      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          role,
          resource,
          permission_level: permissionLevel,
        }, {
          onConflict: 'role,resource'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });

  // Batch update multiple permissions
  const updatePermissions = useMutation({
    mutationFn: async (updates: { role: string; resource: string; permissionLevel: PermissionLevel }[]) => {
      const { error } = await supabase
        .from('role_permissions')
        .upsert(
          updates.map(u => ({
            role: u.role,
            resource: u.resource,
            permission_level: u.permissionLevel,
          })),
          { onConflict: 'role,resource' }
        );
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });

  const getPermission = (role: AppRole, resource: ResourceType): PermissionLevel => {
    return permissionsMap[role]?.[resource] || 'none';
  };

  return {
    permissions,
    permissionsMap,
    isLoading,
    updatePermission,
    updatePermissions,
    getPermission,
  };
};
