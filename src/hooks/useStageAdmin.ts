import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface StageOverviewRow {
  id: string;
  stage_name: string;
  stage_order: number;
  color: string | null;
  is_active: boolean;
  is_won_stage: boolean;
  deals_ativos: number;
  deals_arquivados: number;
  automacoes: number;
  regras_replicacao: number;
  webhooks: number;
  ultimo_movimento: string | null;
  tem_espelho_local: boolean;
  pode_excluir: boolean;
}

/**
 * Erros das RPCs vêm no formato "codigo: mensagem legível".
 * Exibimos apenas a parte após os dois-pontos.
 */
export const parseStageRpcError = (error: unknown): string => {
  const raw = (error as { message?: string })?.message || 'Erro inesperado';
  const idx = raw.indexOf(':');
  return idx > -1 ? raw.slice(idx + 1).trim() || raw : raw;
};

export const useStageAdmin = (originId: string | null) => {
  const queryClient = useQueryClient();
  const { allRoles } = useAuth();
  const podeAdministrar = allRoles.includes('admin') || allRoles.includes('manager');

  const overviewKey = ['admin-stage-overview', originId];

  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stage_overview', {
        p_origin_id: originId as string,
      });
      if (error) throw error;
      return (data || []) as unknown as StageOverviewRow[];
    },
    enabled: !!originId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stage-overview'] });
  };

  const fail = (fallback: string) => (error: unknown) => {
    toast.error(`${fallback}: ${parseStageRpcError(error)}`);
  };

  const updateStage = useMutation({
    mutationFn: async ({
      id,
      stage_name,
      color,
      temEspelhoLocal,
    }: {
      id: string;
      stage_name: string;
      color: string;
      temEspelhoLocal: boolean;
    }) => {
      const { error } = await supabase
        .from('crm_stages')
        .update({ stage_name, color })
        .eq('id', id);
      if (error) throw error;

      // Espelho local é opcional e não-fatal
      if (temEspelhoLocal) {
        const { error: mirrorError } = await supabase
          .from('local_pipeline_stages')
          .update({ name: stage_name, color })
          .eq('id', id);
        if (mirrorError) {
          console.warn('[useStageAdmin] Falha ao espelhar em local_pipeline_stages:', mirrorError.message);
        }
      }
    },
    onSuccess: () => {
      toast.success('Etapa atualizada!');
      invalidateAll();
    },
    onError: fail('Erro ao atualizar etapa'),
  });

  const deactivateStage = useMutation({
    mutationFn: async ({
      stageId,
      moveToStageId,
      motivo,
    }: {
      stageId: string;
      moveToStageId?: string;
      motivo?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_deactivate_crm_stage', {
        p_stage_id: stageId,
        ...(moveToStageId ? { p_move_to_stage_id: moveToStageId } : {}),
        ...(motivo ? { p_motivo: motivo } : {}),
      });
      if (error) throw error;
      return data as unknown as {
        ok: boolean;
        etapa?: string;
        movidos?: number;
        destino?: string;
      };
    },
    onSuccess: (data) => {
      const movidos = data?.movidos ?? 0;
      if (movidos > 0) {
        toast.success(
          `Etapa ${data?.etapa ?? ''} desativada. ${movidos} negócios movidos para ${data?.destino ?? ''}.`.trim()
        );
      } else {
        toast.success(`Etapa ${data?.etapa ?? ''} desativada.`.trim());
      }
      invalidateAll();
    },
    onError: fail('Erro ao desativar etapa'),
  });

  const reactivateStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.rpc('admin_reactivate_crm_stage', { p_stage_id: stageId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Etapa reativada!');
      invalidateAll();
    },
    onError: fail('Erro ao reativar etapa'),
  });

  const deleteStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.rpc('admin_delete_crm_stage', { p_stage_id: stageId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Etapa excluída permanentemente.');
      invalidateAll();
    },
    onError: fail('Erro ao excluir etapa'),
  });

  const reorderStages = useMutation({
    mutationFn: async (stageIds: string[]) => {
      const { error } = await supabase.rpc('admin_reorder_crm_stages', {
        p_origin_id: originId as string,
        p_stage_ids: stageIds,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: fail('Erro ao reordenar etapas'),
  });

  const createStage = useMutation({
    mutationFn: async ({
      stage_name,
      color,
      nextOrder,
    }: {
      stage_name: string;
      color: string;
      nextOrder: number;
    }) => {
      const { data: created, error } = await supabase
        .from('crm_stages')
        .insert({
          stage_name,
          color,
          stage_order: nextOrder,
          origin_id: originId as string,
          is_active: true,
          clint_id: `local-${crypto.randomUUID()}`,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Só espelha localmente se a pipeline já tiver etapas locais —
      // criar a primeira linha local mudaria a fonte de verdade do kanban.
      const { data: locais } = await supabase
        .from('local_pipeline_stages')
        .select('id')
        .eq('origin_id', originId as string)
        .limit(1);

      if (locais && locais.length > 0 && created) {
        const { error: mirrorError } = await supabase.from('local_pipeline_stages').insert({
          id: created.id,
          origin_id: originId as string,
          name: stage_name,
          color,
          stage_order: nextOrder,
        });
        if (mirrorError) {
          console.warn('[useStageAdmin] Falha ao espelhar nova etapa localmente:', mirrorError.message);
        } else {
          const { error: fnError } = await supabase.functions.invoke('ensure-crm-stage-mirror', {
            body: { stage_id: created.id },
          });
          if (fnError) {
            console.warn('[useStageAdmin] ensure-crm-stage-mirror:', fnError.message);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Etapa criada!');
      invalidateAll();
    },
    onError: fail('Erro ao criar etapa'),
  });

  return {
    overview,
    podeAdministrar,
    createStage,
    updateStage,
    deactivateStage,
    reactivateStage,
    deleteStage,
    reorderStages,
  };
};
