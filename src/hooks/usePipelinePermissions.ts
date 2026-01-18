import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PipelinePermission {
  id: string;
  role: string;
  group_id: string | null;
  origin_id: string | null;
  can_view: boolean;
  can_edit: boolean;
}

export const usePipelinePermissions = () => {
  const { role } = useAuth();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['pipeline-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from('pipeline_permissions')
        .select('*')
        .eq('role', role);
      
      if (error) throw error;
      return data as PipelinePermission[];
    },
    enabled: !!role,
  });
  
  // Retorna todos os group_ids que o usuário pode ver
  const getVisibleGroups = (): string[] => {
    return permissions
      .filter(p => p.group_id && p.can_view)
      .map(p => p.group_id!);
  };
  
  // Retorna todos os origin_ids que o usuário pode ver
  const getVisibleOrigins = (): string[] => {
    return permissions
      .filter(p => p.origin_id && p.can_view)
      .map(p => p.origin_id!);
  };
  
  // Verifica se pode ver um grupo específico
  const canViewGroup = (groupId: string): boolean => {
    // Se não há permissões configuradas, permite tudo (admin ou sem restrições)
    if (permissions.length === 0) return true;
    const perm = permissions.find(p => p.group_id === groupId);
    return perm?.can_view ?? false;
  };
  
  // Verifica se pode editar um grupo específico
  const canEditGroup = (groupId: string): boolean => {
    if (permissions.length === 0) return true;
    const perm = permissions.find(p => p.group_id === groupId);
    return perm?.can_edit ?? false;
  };
  
  // Verifica se pode ver uma origem específica
  const canViewOrigin = (originId: string): boolean => {
    if (permissions.length === 0) return true;
    const perm = permissions.find(p => p.origin_id === originId);
    return perm?.can_view ?? false;
  };
  
  // Verifica se pode editar uma origem específica
  const canEditOrigin = (originId: string): boolean => {
    if (permissions.length === 0) return true;
    const perm = permissions.find(p => p.origin_id === originId);
    return perm?.can_edit ?? false;
  };
  
  // Verifica se o usuário tem restrições de permissão (para saber se deve filtrar)
  const hasPermissionRestrictions = (): boolean => {
    return permissions.length > 0;
  };
  
  return {
    permissions,
    isLoading,
    getVisibleGroups,
    getVisibleOrigins,
    canViewGroup,
    canEditGroup,
    canViewOrigin,
    canEditOrigin,
    hasPermissionRestrictions,
  };
};
