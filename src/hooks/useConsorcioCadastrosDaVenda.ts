import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';

/**
 * Todos os cadastros vivos de uma venda (proposta), na ordem das cartas.
 * Mesma regra de ordenação usada na geração do Termo de Adesão: a ordem vem de
 * `consorcio_proposal_cartas.ordem` e, sem vínculo de carta, cai na ordem de
 * criação — sempre depois das cartas vinculadas.
 */
export function useCadastrosDaVenda(proposalId: string | null) {
  return useQuery({
    queryKey: ['consorcio-cadastros-da-venda', proposalId],
    enabled: !!proposalId,
    queryFn: async (): Promise<PendingRegistration[]> => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const vivos = ((data || []) as unknown as PendingRegistration[]).filter(
        (r) => (r as { status?: string }).status !== 'excluida',
      );

      const { data: cartas } = await supabase
        .from('consorcio_proposal_cartas')
        .select('id, ordem, pending_registration_id')
        .eq('proposal_id', proposalId!)
        .order('ordem', { ascending: true });

      const ordemPorReg = new Map<string, number>();
      for (const c of (cartas || []) as Array<{
        ordem: number | null;
        pending_registration_id: string | null;
      }>) {
        if (c.pending_registration_id) ordemPorReg.set(c.pending_registration_id, Number(c.ordem ?? 0));
      }

      return vivos
        .map((r, i) => ({ r, k: ordemPorReg.get(r.id) ?? 1000 + i }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.r);
    },
  });
}
