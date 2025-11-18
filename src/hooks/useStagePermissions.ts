import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StagePermission {
  stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_move_from: boolean;
  can_move_to: boolean;
}

export const useStagePermissions = () => {
  const { role } = useAuth();
  
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['stage-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from('stage_permissions')
        .select('*')
        .eq('role', role);
      
      if (error) throw error;
      return data as StagePermission[];
    },
    enabled: !!role,
  });
  
  const getVisibleStages = () => {
    return permissions
      .filter(p => p.can_view)
      .map(p => p.stage_id);
  };
  
  const canViewStage = (stageId: string) => {
    return permissions.find(p => p.stage_id === stageId)?.can_view ?? false;
  };
  
  const canEditStage = (stageId: string) => {
    return permissions.find(p => p.stage_id === stageId)?.can_edit ?? false;
  };
  
  const canMoveFromStage = (stageId: string) => {
    return permissions.find(p => p.stage_id === stageId)?.can_move_from ?? false;
  };
  
  const canMoveToStage = (stageId: string) => {
    return permissions.find(p => p.stage_id === stageId)?.can_move_to ?? false;
  };
  
  return {
    permissions,
    isLoading,
    getVisibleStages,
    canViewStage,
    canEditStage,
    canMoveFromStage,
    canMoveToStage,
  };
};
