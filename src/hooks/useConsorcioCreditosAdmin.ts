import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsorcioCredito } from '@/types/consorcioProdutos';

export const CONDICOES = [
  { key: 'conv', label: 'Convencional' },
  { key: '50', label: 'Mais por Menos 50%' },
  { key: '25', label: 'Mais por Menos 25%' },
] as const;

export const PRAZOS = [200, 220, 240] as const;

export const PARCELA_COLUMNS: string[] = CONDICOES.flatMap((c) =>
  PRAZOS.flatMap((p) => [`parcela_1a_12a_${c.key}_${p}`, `parcela_demais_${c.key}_${p}`])
);

/** Todos os planos (consorcio_creditos), inclusive inativos, para a tela de cadastro. */
export function useAllConsorcioCreditos() {
  return useQuery({
    queryKey: ['consorcio-creditos-all'],
    queryFn: async (): Promise<ConsorcioCredito[]> => {
      const { data, error } = await supabase
        .from('consorcio_creditos')
        .select('*')
        .order('produto_id', { ascending: true })
        .order('valor_credito', { ascending: true });
      if (error) throw error;
      return (data || []) as ConsorcioCredito[];
    },
  });
}

export function useReactivateConsorcioCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_creditos').update({ ativo: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast.success('Plano reativado'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao reativar plano'),
  });
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['consorcio-creditos-all'] });
  qc.invalidateQueries({ queryKey: ['consorcio-creditos'] });
};

export function useCreateConsorcioCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const { error } = await supabase.from('consorcio_creditos').insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast.success('Plano criado'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar plano'),
  });
}

export function useUpdateConsorcioCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Record<string, any> & { id: string }) => {
      const { error } = await supabase.from('consorcio_creditos').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast.success('Plano atualizado'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar plano'),
  });
}

export function useDeleteConsorcioCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_creditos').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast.success('Plano removido'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover plano'),
  });
}
