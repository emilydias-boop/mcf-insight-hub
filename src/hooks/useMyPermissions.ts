import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel } from '@/types/user-management';

interface Permission {
  resource: ResourceType;
  permission_level: PermissionLevel;
}

export const useMyPermissions = () => {
  const { user, role } = useAuth();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('resource, permission_level')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return (data || []) as Permission[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Admin sempre tem acesso total
  const isAdmin = role === 'admin';
  
  const canAccessResource = (resource: ResourceType): boolean => {
    if (isAdmin) return true;
    const perm = permissions.find(p => p.resource === resource);
    return !!perm && perm.permission_level !== 'none';
  };
  
  const getPermissionLevel = (resource: ResourceType): PermissionLevel => {
    if (isAdmin) return 'full';
    const perm = permissions.find(p => p.resource === resource);
    return perm?.permission_level || 'none';
  };
  
  return { 
    permissions, 
    isLoading, 
    canAccessResource, 
    getPermissionLevel,
    isAdmin 
  };
};
