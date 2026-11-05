import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EstruturaRaw, Requisicao } from '@/lib/estruturaOrg';

const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export function useEstruturaOrg(data: string) {
  return useQuery({
    queryKey: ['estrutura-org', data],
    queryFn: () => rpc<EstruturaRaw>('gov_estrutura_em', { p_data: data }),
    staleTime: 60_000,
  });
}

/** Requisições visíveis segundo as regras atuais (RLS). */
export function useRequisicoesAbertas() {
  return useQuery({
    queryKey: ['estrutura-org-requisicoes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('gov_requisicoes_contratacao')
        .select('id,cargo_catalogo_id,departamento_id,status')
        .in('status', ['em_aprovacao', 'aprovada', 'em_recrutamento']);
      if (error) return [] as Requisicao[];
      return (data ?? []) as Requisicao[];
    },
    staleTime: 60_000,
  });
}

export function useEstruturaMutacao<A extends Record<string, unknown>>(fn: string, sucesso: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => rpc<unknown>(fn, args),
    onSuccess: () => {
      toast.success(sucesso);
      qc.invalidateQueries({ queryKey: ['estrutura-org'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar'),
  });
}
