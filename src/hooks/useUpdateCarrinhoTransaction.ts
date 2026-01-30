import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateCarrinhoTransactionParams {
  id: string;
  product_name: string;
  product_price: number;
  net_value: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  sale_date: string;
}

export function useUpdateCarrinhoTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateCarrinhoTransactionParams) => {
      const { id, ...updateData } = params;
      
      const { data, error } = await supabase
        .from('hubla_transactions')
        .update({
          product_name: updateData.product_name,
          product_price: updateData.product_price,
          net_value: updateData.net_value,
          customer_name: updateData.customer_name,
          customer_email: updateData.customer_email,
          customer_phone: updateData.customer_phone || null,
          sale_date: updateData.sale_date,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-transactions'] });
      toast.success('Venda atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating carrinho transaction:', error);
      toast.error('Erro ao atualizar venda');
    },
  });
}
