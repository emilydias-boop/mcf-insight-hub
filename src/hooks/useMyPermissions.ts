import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel } from '@/types/user-management';
import { useActiveBU } from '@/hooks/useActiveBU';

interface RolePermission {
  resource: string;
  permission_level: string;
  bu: string | null;
}

export const useMyPermissions = () => {
  const { role } = useAuth();
  const activeBU = useActiveBU();
  
  // Fetch all permissions for user's role (global + all BUs)
  const { data: rolePermissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('resource, permission_level, bu')
        .eq('role', role);
      
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
    enabled: !!role,
    staleTime: 5 * 60 * 1000,
  });
  
  const isAdmin = role === 'admin';
  
  const canAccessResource = (resource: ResourceType): boolean => {
    if (isAdmin) return true;
    
    // Check BU-specific permission first, then fall back to global
    const buPerm = activeBU 
      ? rolePermissions.find(p => p.resource === resource && p.bu === activeBU)
      : null;
    
    if (buPerm) return buPerm.permission_level !== 'none';
    
    // Fall back to global permission (bu = null)
    const globalPerm = rolePermissions.find(p => p.resource === resource && p.bu === null);
    return !!globalPerm && globalPerm.permission_level !== 'none';
  };
  
  const getPermissionLevel = (resource: ResourceType): PermissionLevel => {
    if (isAdmin) return 'full';
    
    // BU-specific overrides global
    const buPerm = activeBU
      ? rolePermissions.find(p => p.resource === resource && p.bu === activeBU)
      : null;
    
    if (buPerm) return buPerm.permission_level as PermissionLevel;
    
    const globalPerm = rolePermissions.find(p => p.resource === resource && p.bu === null);
    return (globalPerm?.permission_level as PermissionLevel) || 'none';
  };
  
  return { 
    permissions: rolePermissions, 
    isLoading, 
    canAccessResource, 
    getPermissionLevel,
    isAdmin 
  };
};
