import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseQualificationOptions {
  dealId: string;
  originId?: string;
  currentStageId?: string;
  onQualified?: () => void;
}

// Mapeamento de origin para stage de qualificação
const QUALIFICATION_STAGE_MAP: Record<string, string> = {
  // Pode ser expandido conforme necessário
  // 'origin_id': 'stage_id_qualificado'
};

export function useQualification({ 
  dealId, 
  originId, 
  currentStageId,
  onQualified 
}: UseQualificationOptions) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Mutation para atualizar custom_fields
  const updateFieldMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data: deal, error: fetchError } = await supabase
        .from('crm_deals')
        .select('custom_fields')
        .eq('id', dealId)
        .single();

      if (fetchError) throw fetchError;

      const currentFields = (deal?.custom_fields as Record<string, unknown>) || {};
      const updatedFields = { ...currentFields, [key]: value };

      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ custom_fields: updatedFields as Record<string, string | number | boolean | null> })
        .eq('id', dealId);

      if (updateError) throw updateError;

      return updatedFields;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar campo:', error);
      toast.error('Erro ao salvar campo');
    },
  });

  // Mutation para mover para stage qualificado
  const moveToQualifiedMutation = useMutation({
    mutationFn: async () => {
      // Buscar stage "Lead Qualificado" da mesma origem
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .eq('origin_id', originId)
        .or('stage_name.ilike.%qualificado%,stage_name.ilike.%qualified%')
        .order('stage_order', { ascending: true })
        .limit(1);

      if (stagesError) throw stagesError;
      
      if (!stages || stages.length === 0) {
        console.log('Nenhum stage de qualificação encontrado para origem:', originId);
        return null;
      }

      const qualifiedStageId = stages[0].id;

      // Não mover se já está no stage ou em stage posterior
      if (currentStageId === qualifiedStageId) {
        return null;
      }

      // Atualizar o deal
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ stage_id: qualifiedStageId })
        .eq('id', dealId);

      if (updateError) throw updateError;

      // Registrar atividade
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'stage_change',
        description: `Lead qualificado automaticamente`,
        from_stage: currentStageId,
        to_stage: qualifiedStageId,
      });

      return qualifiedStageId;
    },
    onSuccess: (stageId) => {
      if (stageId) {
        queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] });
        queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
        toast.success('Lead movido para etapa Qualificado!');
        onQualified?.();
      }
    },
    onError: (error) => {
      console.error('Erro ao mover para qualificado:', error);
      toast.error('Erro ao mover lead para qualificado');
    },
  });

  // Handler com debounce para atualizar campo
  const updateField = useCallback((key: string, value: unknown) => {
    setIsUpdating(true);
    
    // Debounce para evitar muitas requisições
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      updateFieldMutation.mutate({ key, value }, {
        onSettled: () => setIsUpdating(false)
      });
    }, 500);
  }, [updateFieldMutation]);

  // Mover para qualificado quando completar
  const moveToQualified = useCallback(() => {
    if (originId) {
      moveToQualifiedMutation.mutate();
    }
  }, [originId, moveToQualifiedMutation]);

  return {
    updateField,
    moveToQualified,
    isUpdating: isUpdating || updateFieldMutation.isPending,
    isMoving: moveToQualifiedMutation.isPending,
  };
}
