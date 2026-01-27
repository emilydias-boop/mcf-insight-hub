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
          origin_id: originId,
          group_id: groupId || data.parent_group_id,
        }));

        const { error: stagesError } = await supabase
          .from('local_pipeline_stages')
          .insert(stagesToInsert);

        if (stagesError) throw new Error(`Erro ao criar etapas: ${stagesError.message}`);
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
        const { error: webhookError } = await supabase
          .from('webhook_endpoints')
          .insert({
            name: data.name,
            slug: data.integration.slug,
            origin_id: originId!,
            stage_id: data.integration.initial_stage_id || null,
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
