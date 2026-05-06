import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConsorcioProduto, ConsorcioCredito } from '@/types/consorcioProdutos';
import { toast } from 'sonner';

export function useConsorcioProdutos() {
  return useQuery({
    queryKey: ['consorcio-produtos'],
    queryFn: async (): Promise<ConsorcioProduto[]> => {
      const { data, error } = await supabase
        .from('consorcio_produtos')
        .select('*')
        .eq('ativo', true)
        .order('faixa_credito_min', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        prazos_disponiveis: item.prazos_disponiveis || [200, 220, 240],
        fundo_reserva: item.fundo_reserva || 2,
        seguro_vida_percentual: item.seguro_vida_percentual || 0.0610,
        comissao_schedule: (item as any).comissao_schedule ?? null,
        comissao_base: (item as any).comissao_base ?? 'valor_credito',
      })) as unknown as ConsorcioProduto[];
    },
  });
}

export type ConsorcioProdutoInput = Partial<Omit<ConsorcioProduto, 'id' | 'created_at' | 'updated_at'>> & {
  codigo: string;
  nome: string;
  faixa_credito_min: number;
  faixa_credito_max: number;
  taxa_antecipada_percentual: number;
  taxa_antecipada_tipo: 'primeira_parcela' | 'dividida_12';
};

export function useCreateConsorcioProduto() {
  // returns mutation
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConsorcioProdutoInput) => {
      const { error } = await supabase.from('consorcio_produtos').insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-produtos'] });
      toast.success('Produto criado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar produto'),
  });
}

export function useUpdateConsorcioProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ConsorcioProduto> & { id: string }) => {
      const { error } = await supabase.from('consorcio_produtos').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-produtos'] });
      toast.success('Produto atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar produto'),
  });
}

export function useDeleteConsorcioProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_produtos').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-produtos'] });
      toast.success('Produto removido');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover produto'),
  });
}

export function useConsorcioCreditos(produtoId?: string) {
  return useQuery({
    queryKey: ['consorcio-creditos', produtoId],
    queryFn: async (): Promise<ConsorcioCredito[]> => {
      let query = supabase
        .from('consorcio_creditos')
        .select('*')
        .eq('ativo', true)
        .order('valor_credito', { ascending: true });

      if (produtoId) {
        query = query.eq('produto_id', produtoId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ConsorcioCredito[];
    },
    enabled: !!produtoId,
  });
}

// Hook para buscar créditos por valor específico (para usar valores tabelados)
export function useConsorcioCreditoByValor(produtoId?: string, valorCredito?: number) {
  const { data: creditos } = useConsorcioCreditos(produtoId);
  
  if (!creditos || !valorCredito) return undefined;
  
  // Busca exata pelo valor do crédito
  return creditos.find(c => c.valor_credito === valorCredito);
}

export function useProdutoByCredito(valorCredito: number, tipoTaxa?: 'dividida_12' | 'primeira_parcela') {
  const { data: produtos } = useConsorcioProdutos();

  if (!produtos || valorCredito <= 0) return undefined;

  return produtos.find(p => 
    p.ativo &&
    valorCredito >= p.faixa_credito_min &&
    valorCredito <= p.faixa_credito_max &&
    (!tipoTaxa || p.taxa_antecipada_tipo === tipoTaxa)
  );
}
