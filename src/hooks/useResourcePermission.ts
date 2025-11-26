import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ResourceType, PermissionLevel } from '@/types/user-management';

export const useResourcePermission = (resource: ResourceType) => {
  const { user, role } = useAuth();
  
  const { data: permissions = [] } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
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
  
  const permission = permissions.find(p => p.resource === resource);
  
  return {
    canView: permission?.permission_level !== 'none' && !!permission,
    canEdit: permission?.permission_level === 'edit' || permission?.permission_level === 'full',
    canFull: permission?.permission_level === 'full',
    level: permission?.permission_level || 'none' as PermissionLevel,
  };
};
