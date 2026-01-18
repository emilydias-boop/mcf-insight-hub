import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PipelinePermission {
  id: string;
  role: string;
  group_id: string | null;
  origin_id: string | null;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

interface StagePermission {
  id: string;
  role: string;
  stage_id: string;
  stage_uuid: string | null;
  can_view: boolean;
  can_edit: boolean;
  can_move_from: boolean;
  can_move_to: boolean;
}

export const useCRMPermissionsAdmin = () => {
  const queryClient = useQueryClient();

  // Buscar todas as permissões de pipeline
  const { data: pipelinePermissions = [], isLoading: loadingPipeline } = useQuery({
    queryKey: ['admin-pipeline-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_permissions')
        .select('*')
        .order('role');
      
      if (error) throw error;
      return data as PipelinePermission[];
    },
  });

  // Buscar todas as permissões de estágio
  const { data: stagePermissions = [], isLoading: loadingStage } = useQuery({
    queryKey: ['admin-stage-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_permissions')
        .select('*')
        .order('role');
      
      if (error) throw error;
      return data as StagePermission[];
    },
  });

  // Buscar grupos do CRM
  const { data: groups = [] } = useQuery({
    queryKey: ['crm-groups-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, display_name')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar origens do CRM
  const { data: origins = [] } = useQuery({
    queryKey: ['crm-origins-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name, display_name, group_id')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar estágios do CRM
  const { data: stages = [] } = useQuery({
    queryKey: ['crm-stages-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('id, stage_name, stage_order, color, is_active, origin_id')
        .eq('is_active', true)
        .order('stage_order');
      
      if (error) throw error;
      return data;
    },
  });

  // Upsert permissão de grupo
  const upsertGroupPermission = useMutation({
    mutationFn: async ({
      role,
      groupId,
      canView,
      canEdit,
    }: {
      role: string;
      groupId: string;
      canView: boolean;
      canEdit: boolean;
    }) => {
      const { error } = await supabase
        .from('pipeline_permissions')
        .upsert({
          role,
          group_id: groupId,
          origin_id: null,
          can_view: canView,
          can_edit: canEdit,
        }, {
          onConflict: 'role,group_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pipeline-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-permissions'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar permissão: ' + error.message);
    },
  });

  // Upsert permissão de origem
  const upsertOriginPermission = useMutation({
    mutationFn: async ({
      role,
      originId,
      canView,
      canEdit,
    }: {
      role: string;
      originId: string;
      canView: boolean;
      canEdit: boolean;
    }) => {
      const { error } = await supabase
        .from('pipeline_permissions')
        .upsert({
          role,
          group_id: null,
          origin_id: originId,
          can_view: canView,
          can_edit: canEdit,
        }, {
          onConflict: 'role,origin_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pipeline-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-permissions'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar permissão: ' + error.message);
    },
  });

  // Upsert permissão de estágio
  const upsertStagePermission = useMutation({
    mutationFn: async ({
      role,
      stageUuid,
      canView,
      canEdit,
      canMoveFrom,
      canMoveTo,
    }: {
      role: string;
      stageUuid: string;
      canView: boolean;
      canEdit: boolean;
      canMoveFrom: boolean;
      canMoveTo: boolean;
    }) => {
      // First try to update existing, if not exists, insert
      const { data: existing } = await supabase
        .from('stage_permissions')
        .select('id')
        .eq('role', role as any)
        .eq('stage_id', stageUuid)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('stage_permissions')
          .update({
            stage_uuid: stageUuid,
            can_view: canView,
            can_edit: canEdit,
            can_move_from: canMoveFrom,
            can_move_to: canMoveTo,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stage_permissions')
          .insert({
            role: role as any,
            stage_uuid: stageUuid,
            stage_id: stageUuid,
            can_view: canView,
            can_edit: canEdit,
            can_move_from: canMoveFrom,
            can_move_to: canMoveTo,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stage-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['stage-permissions'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar permissão: ' + error.message);
    },
  });

  // Deletar permissão de pipeline
  const deletePermission = useMutation({
    mutationFn: async (permissionId: string) => {
      const { error } = await supabase
        .from('pipeline_permissions')
        .delete()
        .eq('id', permissionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pipeline-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-permissions'] });
    },
  });

  // Batch update de permissões para um role
  const batchUpdatePermissions = useMutation({
    mutationFn: async ({
      role,
      groupPermissions,
    }: {
      role: string;
      groupPermissions: { groupId: string; canView: boolean; canEdit: boolean }[];
    }) => {
      // Deletar permissões existentes para o role
      await supabase
        .from('pipeline_permissions')
        .delete()
        .eq('role', role)
        .not('group_id', 'is', null);

      // Inserir novas permissões
      if (groupPermissions.length > 0) {
        const { error } = await supabase
          .from('pipeline_permissions')
          .insert(
            groupPermissions.map(p => ({
              role,
              group_id: p.groupId,
              origin_id: null,
              can_view: p.canView,
              can_edit: p.canEdit,
            }))
          );
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pipeline-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-permissions'] });
      toast.success('Permissões atualizadas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });

  // Obter permissão de grupo para um role
  const getGroupPermission = (role: string, groupId: string) => {
    return pipelinePermissions.find(
      p => p.role === role && p.group_id === groupId
    );
  };

  // Obter permissão de origem para um role
  const getOriginPermission = (role: string, originId: string) => {
    return pipelinePermissions.find(
      p => p.role === role && p.origin_id === originId
    );
  };

  // Obter permissão de estágio para um role
  const getStagePermission = (role: string, stageId: string) => {
    return stagePermissions.find(
      p => p.role === role && (p.stage_uuid === stageId || p.stage_id === stageId)
    );
  };

  return {
    pipelinePermissions,
    stagePermissions,
    groups,
    origins,
    stages,
    isLoading: loadingPipeline || loadingStage,
    upsertGroupPermission,
    upsertOriginPermission,
    upsertStagePermission,
    deletePermission,
    batchUpdatePermissions,
    getGroupPermission,
    getOriginPermission,
    getStagePermission,
  };
};
