import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type NextActionType = 'ligar' | 'whatsapp' | 'email' | 'reuniao';

interface NextActionData {
  dealId: string;
  actionType: NextActionType | null;
  actionDate: Date | null;
  actionNote: string;
}

/**
 * Hook para salvar próxima ação de um deal
 */
export const useSaveNextAction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, actionType, actionDate, actionNote }: NextActionData) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({
          next_action_type: actionType,
          next_action_date: actionDate?.toISOString() || null,
          next_action_note: actionNote || null
        })
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Próxima ação salva com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar próxima ação: ${error.message}`);
    },
  });
};

/**
 * Hook para adicionar nota ao deal (cria activity do tipo note)
 */
export const useAddDealNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, note }: { dealId: string; note: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'note',
          description: note,
          user_id: userData.user?.id,
          metadata: {
            author: userData.user?.email,
            timestamp: new Date().toISOString()
          }
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-notes', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] });
      toast.success('Nota adicionada');
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar nota: ${error.message}`);
    },
  });
};

/**
 * Hook para buscar notas do deal
 */
export const useDealNotes = (dealId: string) => {
  const queryClient = useQueryClient();
  
  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] });
    }
  };
};
