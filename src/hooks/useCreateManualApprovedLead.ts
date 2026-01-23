import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateManualLeadParams {
  transactionId: string;
  closerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  scheduledAt?: string;
}

export function useCreateManualApprovedLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateManualLeadParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar logado para criar um lead manual');
      }

      const response = await supabase.functions.invoke('create-manual-approved-lead', {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar lead manual');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Lead criado e vinculado com sucesso!');
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['all-approved-attendees'] });
    },
    onError: (error: Error) => {
      console.error('Error creating manual lead:', error);
      toast.error(error.message || 'Erro ao criar lead manual');
    },
  });
}
