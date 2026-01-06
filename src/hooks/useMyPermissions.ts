import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel } from '@/types/user-management';

interface RolePermission {
  resource: string;
  permission_level: string;
}

export const useMyPermissions = () => {
  const { role } = useAuth();
  
  // Fetch permissions from role_permissions table based on user's role
  const { data: rolePermissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('resource, permission_level')
        .eq('role', role);
      
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
    enabled: !!role,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Admin sempre tem acesso total
  const isAdmin = role === 'admin';
  
  const canAccessResource = (resource: ResourceType): boolean => {
    if (isAdmin) return true;
    const perm = rolePermissions.find(p => p.resource === resource);
    return !!perm && perm.permission_level !== 'none';
  };
  
  const getPermissionLevel = (resource: ResourceType): PermissionLevel => {
    if (isAdmin) return 'full';
    const perm = rolePermissions.find(p => p.resource === resource);
    return (perm?.permission_level as PermissionLevel) || 'none';
  };
  
  return { 
    permissions: rolePermissions, 
    isLoading, 
    canAccessResource, 
    getPermissionLevel,
    isAdmin 
  };
};
