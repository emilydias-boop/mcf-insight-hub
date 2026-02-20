import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface ProdutoOption {
  id: string;
  name: string;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DealProdutoAdquirido {
  id: string;
  deal_id: string;
  produto_option_id: string;
  valor: number;
  created_at: string;
  consorcio_produto_adquirido_options?: ProdutoOption;
}

// ===== OPTIONS HOOKS =====

export const useProdutoAdquiridoOptions = () => {
  return useQuery({
    queryKey: ['produto-adquirido-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProdutoOption[];
    },
  });
};

export const useAllProdutoAdquiridoOptions = () => {
  return useQuery({
    queryKey: ['produto-adquirido-options-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProdutoOption[];
    },
  });
};

export const useCreateProdutoAdquiridoOption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, label }: { name: string; label: string }) => {
      const { data, error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .insert({ name, label } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options'] });
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options-all'] });
      toast.success('Opção criada com sucesso');
    },
    onError: () => toast.error('Erro ao criar opção'),
  });
};

export const useUpdateProdutoAdquiridoOption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label, is_active }: { id: string; label?: string; is_active?: boolean }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (label !== undefined) updates.label = label;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options'] });
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options-all'] });
      toast.success('Opção atualizada');
    },
    onError: () => toast.error('Erro ao atualizar opção'),
  });
};

export const useDeleteProdutoAdquiridoOption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options'] });
      queryClient.invalidateQueries({ queryKey: ['produto-adquirido-options-all'] });
      toast.success('Opção removida');
    },
    onError: () => toast.error('Erro ao remover opção'),
  });
};

// ===== DEAL PRODUTOS HOOKS =====

export const useDealProdutosAdquiridos = (dealId: string) => {
  return useQuery({
    queryKey: ['deal-produtos-adquiridos', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_produtos_adquiridos' as any)
        .select('*, consorcio_produto_adquirido_options(*)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DealProdutoAdquirido[];
    },
    enabled: !!dealId,
  });
};

export const useAddDealProdutoAdquirido = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deal_id, produto_option_id, valor }: { deal_id: string; produto_option_id: string; valor: number }) => {
      const { error } = await supabase
        .from('deal_produtos_adquiridos' as any)
        .insert({ deal_id, produto_option_id, valor } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['deal-produtos-adquiridos', vars.deal_id] });
      toast.success('Produto adicionado');
    },
    onError: (err: any) => {
      if (err?.code === '23505') {
        toast.error('Este produto já foi adicionado a este negócio');
      } else {
        toast.error('Erro ao adicionar produto');
      }
    },
  });
};

export const useRemoveDealProdutoAdquirido = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deal_id }: { id: string; deal_id: string }) => {
      const { error } = await supabase
        .from('deal_produtos_adquiridos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return deal_id;
    },
    onSuccess: (deal_id) => {
      queryClient.invalidateQueries({ queryKey: ['deal-produtos-adquiridos', deal_id] });
      toast.success('Produto removido');
    },
    onError: () => toast.error('Erro ao remover produto'),
  });
};
