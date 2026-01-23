import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LinkParams {
  transactionId: string;
  attendeeId: string | null;
}

export function useLinkTransactionToAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, attendeeId }: LinkParams) => {
      const { error } = await supabase
        .from('hubla_transactions')
        .update({ linked_attendee_id: attendeeId })
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      toast.success('Venda vinculada com sucesso!');
    },
    onError: (error) => {
      console.error('Error linking transaction:', error);
      toast.error('Erro ao vincular venda');
    },
  });
}
