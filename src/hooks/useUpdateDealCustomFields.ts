import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateDealCustomFieldsParams {
  dealId: string;
  customFields: Record<string, unknown>;
}

export function useUpdateDealCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, customFields }: UpdateDealCustomFieldsParams) => {
      // First, get current custom_fields to merge
      const { data: currentDeal, error: fetchError } = await supabase
        .from('crm_deals')
        .select('custom_fields')
        .eq('id', dealId)
        .single();

      if (fetchError) throw fetchError;

      // Merge existing custom_fields with new ones
      const mergedFields = {
        ...(currentDeal?.custom_fields as Record<string, unknown> || {}),
        ...customFields,
      };

      // Update the deal with merged custom_fields
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ custom_fields: mergedFields as any })
        .eq('id', dealId);

      if (updateError) throw updateError;

      return { dealId, customFields: mergedFields };
    },
    onSuccess: () => {
      // Invalidate R2 meetings to refresh drawer data
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
    },
    onError: (error) => {
      console.error('Error updating deal custom fields:', error);
      toast.error('Erro ao atualizar campos do lead');
    },
  });
}
