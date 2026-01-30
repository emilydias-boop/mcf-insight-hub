import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateCarrinhoTransactionParams {
  product_name: string;
  product_price: number;
  net_value: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  sale_date: string;
  linked_attendee_id: string;
}

export function useCreateCarrinhoTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCarrinhoTransactionParams) => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .insert({
          hubla_id: `manual-${Date.now()}`,
          event_type: 'purchase.completed', // Campo obrigatório
          product_name: params.product_name,
          product_price: params.product_price,
          net_value: params.net_value,
          customer_name: params.customer_name,
          customer_email: params.customer_email,
          customer_phone: params.customer_phone || null,
          sale_date: params.sale_date,
          product_category: 'parceria', // ← CHAVE para aparecer no R2 Carrinho
          linked_attendee_id: params.linked_attendee_id, // ← Vincula ao lead aprovado
          source: 'manual',
          sale_status: 'completed',
          count_in_dashboard: true,
          installment_number: 1,
          total_installments: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-transactions'] });
      toast.success('Venda de parceria criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating carrinho transaction:', error);
      toast.error('Erro ao criar venda de parceria');
    },
  });
}
