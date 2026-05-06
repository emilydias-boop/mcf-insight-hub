import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const deleteSingleDeal = async (id: string) => {
  // Usa RPC SECURITY DEFINER que valida ownership/role e remove cascata
  // num único call (resolve restrições de RLS para SDR/closer em tabelas
  // dependentes).
  const { error } = await supabase.rpc('delete_deal_cascade', { p_deal_id: id });
  if (error) throw error;
};

export const useBulkDeleteDeals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete sequentially to avoid FK issues
      for (const id of ids) {
        await deleteSingleDeal(id);
      }
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-slots'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts-with-deals'] });
      toast.success(`${ids.length} lead${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''} com sucesso`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir leads: ${error.message}`);
    },
  });
};
