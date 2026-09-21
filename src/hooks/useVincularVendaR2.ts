import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VendaSemVinculo {
  id: string;
  produto: string;
  gateway: string | null;
  sale_date: string;
  liquido: number;
  bruto: number;
  parcela: number | null;
  total_parcelas: number | null;
  comprador_nome: string | null;
  comprador_email: string | null;
  comprador_telefone: string | null;
  comprador_cpf: string | null;
  eh_parceria: boolean;
  match_cpf: boolean;
  match_telefone: boolean;
  match_email: boolean;
  match_nome: boolean;
  score: number;
}

export interface VendaVinculada {
  id: string;
  produto: string;
  gateway: string | null;
  sale_date: string;
  liquido: number;
  bruto: number;
  comprador_nome: string | null;
  comprador_email: string | null;
  vinculada_em: string | null;
  vinculada_por: string | null;
  metodo: string | null;
}

/** Vendas ainda sem dono, rankeadas por semelhança com o participante. */
export function useVendasSemVinculo(attendeeId?: string | null, busca?: string) {
  const termo = (busca || '').trim();
  return useQuery({
    queryKey: ['vendas-sem-vinculo', attendeeId, termo],
    enabled: !!attendeeId,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<VendaSemVinculo[]> => {
      const { data, error } = await supabase.rpc('get_vendas_sem_vinculo' as any, {
        p_attendee_id: attendeeId,
        p_busca: termo.length >= 2 ? termo : null,
        p_limit: 60,
      });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        liquido: Number(r.liquido) || 0,
        bruto: Number(r.bruto) || 0,
        score: Number(r.score) || 0,
      }));
    },
  });
}

/** Vendas que já estão amarradas neste participante. */
export function useVendasDoParticipante(attendeeId?: string | null) {
  return useQuery({
    queryKey: ['vendas-do-participante', attendeeId],
    enabled: !!attendeeId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<VendaVinculada[]> => {
      const { data, error } = await supabase.rpc('get_vendas_do_participante' as any, {
        p_attendee_id: attendeeId,
      });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        liquido: Number(r.liquido) || 0,
        bruto: Number(r.bruto) || 0,
      }));
    },
  });
}

function invalidarTudo(qc: ReturnType<typeof useQueryClient>) {
  ['vendas-sem-vinculo', 'vendas-do-participante', 'agenda-meetings', 'r2-metrics',
   'r2-agenda', 'crm-deals', 'lead-full-timeline', 'compras-do-cliente',
   'totais-por-cliente', 'deal-activities'].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] })
  );
}

export function useVincularVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, attendeeId }: { transactionId: string; attendeeId: string }) => {
      const { data, error } = await supabase.rpc('vincular_venda_ao_participante' as any, {
        p_transaction_id: transactionId,
        p_attendee_id: attendeeId,
      });
      if (error) throw error;
      return data as { ok: boolean; etapa_nova?: string | null; produto?: string | null };
    },
    onSuccess: (res) => {
      invalidarTudo(qc);
      toast.success(
        res?.etapa_nova
          ? `Venda vinculada. Lead movido para "${res.etapa_nova}".`
          : 'Venda vinculada.'
      );
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Não foi possível vincular a venda');
    },
  });
}

export function useDesvincularVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase.rpc('desvincular_venda_do_participante' as any, {
        p_transaction_id: transactionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success('Venda desvinculada. A etapa do Kanban não voltou sozinha — mova manualmente se precisar.');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Não foi possível desvincular');
    },
  });
}
