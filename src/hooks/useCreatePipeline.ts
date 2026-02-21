import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { WizardData } from '@/components/crm/wizard/types';

interface CreatePipelineResult {
  groupId?: string;
  originId?: string;
  type: 'group' | 'origin';
  name: string;
}

export const useCreatePipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WizardData): Promise<CreatePipelineResult> => {
      const timestamp = Date.now();
      let groupId: string | undefined;
      let originId: string | undefined;
      let stageIdMap: Map<string, string> = new Map();

      // 1. Create Group or Origin
      if (data.type === 'group') {
        const { data: newGroup, error: groupError } = await supabase
          .from('crm_groups')
          .insert({
            clint_id: `local-group-${timestamp}`,
            name: data.name,
            display_name: data.display_name || null,
            description: data.description || null,
            is_archived: false,
          })
          .select('id')
          .single();

        if (groupError) throw new Error(`Erro ao criar grupo: ${groupError.message}`);
        groupId = newGroup.id;

        // For groups, also create a default origin
        const { data: defaultOrigin, error: originError } = await supabase
          .from('crm_origins')
          .insert({
            clint_id: `local-origin-${timestamp}-default`,
            name: data.name,
            display_name: data.display_name || null,
            description: data.description || null,
            group_id: groupId,
            pipeline_type: 'outros',
            is_archived: false,
          })
          .select('id')
          .single();

        if (originError) throw new Error(`Erro ao criar origin padrão: ${originError.message}`);
        originId = defaultOrigin.id;
      } else {
        // Create Origin
        const { data: newOrigin, error: originError } = await supabase
          .from('crm_origins')
          .insert({
            clint_id: `local-origin-${timestamp}`,
            name: data.name,
            display_name: data.display_name || null,
            description: data.description || null,
            group_id: data.parent_group_id,
            pipeline_type: 'outros',
            is_archived: false,
          })
          .select('id')
          .single();

        if (originError) throw new Error(`Erro ao criar origin: ${originError.message}`);
        originId = newOrigin.id;
      }

      // 2. Create Stages
      if (data.stages.length > 0) {
        const stagesToInsert = data.stages.map((stage, index) => ({
          name: stage.name,
          color: stage.color,
          stage_order: index,
          stage_type: stage.stage_type,
          // Constraint exige apenas UM parent: origin OU group (XOR)
          origin_id: originId || null,
          group_id: originId ? null : (groupId || data.parent_group_id),
        }));

        const { data: createdStages, error: stagesError } = await supabase
          .from('local_pipeline_stages')
          .insert(stagesToInsert)
          .select('id, stage_order, name, color, stage_type');

        if (stagesError) throw new Error(`Erro ao criar etapas: ${stagesError.message}`);

        // Criar mapeamento e espelhar em crm_stages
        if (createdStages && originId) {
          createdStages.forEach((dbStage) => {
            const wizardStage = data.stages.find(s => s.stage_order === dbStage.stage_order);
            if (wizardStage) {
              stageIdMap.set(wizardStage.id, dbStage.id);
            }
          });

          // Espelhar todos os stages em crm_stages para evitar erro de FK
          const crmMirrors = createdStages.map((s: any) => ({
            id: s.id,
            clint_id: `local-${s.id}`,
            stage_name: s.name,
            color: s.color,
            stage_order: s.stage_order,
            stage_type: s.stage_type,
            origin_id: originId,
            is_active: true,
          }));

          const { error: mirrorError } = await supabase
            .from('crm_stages')
            .insert(crmMirrors);

          if (mirrorError) {
            console.warn('[useCreatePipeline] Erro ao espelhar em crm_stages (não-fatal):', mirrorError.message);
          }
        }
      }

      // 3. Create Distribution Config (if configured)
      if (data.distribution.length > 0) {
        const distributionToInsert = data.distribution
          .filter((d) => d.is_active && d.percentage > 0)
          .map((dist) => ({
            origin_id: originId!,
            user_email: dist.user_email,
            percentage: dist.percentage,
            is_active: true,
            current_count: 0,
          }));

        if (distributionToInsert.length > 0) {
          const { error: distError } = await supabase
            .from('lead_distribution_config')
            .insert(distributionToInsert);

          if (distError) throw new Error(`Erro ao configurar distribuição: ${distError.message}`);
        }
      }

      // 4. Create Webhook Endpoint (if enabled)
      if (data.integration.enabled && data.integration.slug) {
        // Mapear ID temporário para ID real do banco
        let realStageId: string | null = null;
        if (data.integration.initial_stage_id) {
          realStageId = stageIdMap.get(data.integration.initial_stage_id) || null;
        }

        const { error: webhookError } = await supabase
          .from('webhook_endpoints')
          .insert({
            name: data.name,
            slug: data.integration.slug,
            origin_id: originId!,
            stage_id: realStageId,
            auto_tags: data.integration.auto_tags.length > 0 ? data.integration.auto_tags : null,
            is_active: true,
          });

        if (webhookError) throw new Error(`Erro ao criar webhook: ${webhookError.message}`);
      }

      return {
        groupId,
        originId,
        type: data.type,
        name: data.name,
      };
    },
    onSuccess: (result) => {
      toast({
        title: 'Pipeline criado com sucesso!',
        description: `${result.type === 'group' ? 'Grupo' : 'Origin'} "${result.name}" foi criado.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['crm-groups'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-groups-for-collapsed-sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins-by-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] }); // Invalidar cache de stages
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
