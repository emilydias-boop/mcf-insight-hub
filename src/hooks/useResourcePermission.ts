import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel } from '@/types/user-management';

export const useResourcePermission = (resource: ResourceType) => {
  const { role } = useAuth();
  
  const { data: permission } = useQuery({
    queryKey: ['role-permission', role, resource],
    queryFn: async () => {
      if (!role) return null;
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_level')
        .eq('role', role)
        .eq('resource', resource)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!role,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Admins sempre têm acesso total
  if (role === 'admin') {
    return {
      canView: true,
      canEdit: true,
      canFull: true,
      level: 'full' as PermissionLevel,
    };
  }
  
  const level = (permission?.permission_level as PermissionLevel) || 'none';
  
  return {
    canView: level !== 'none',
    canEdit: level === 'edit' || level === 'full',
    canFull: level === 'full',
    level,
  };
};
