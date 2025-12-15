import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useCreateDealActivity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      deal_id: string;
      activity_type: string;
      description: string;
      from_stage?: string;
      to_stage?: string;
      user_id?: string;
      metadata?: any;
    }) => {
      const { data: result, error } = await supabase
        .from('deal_activities')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.deal_id] });
      toast.success('Atividade registrada');
    },
    onError: (error) => {
      console.error('Error creating activity:', error);
      toast.error('Erro ao registrar atividade');
    },
  });
};
