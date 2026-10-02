import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VendaSemVinculo, VendaVinculada } from '@/hooks/useVincularVendaR2';

/**
 * Venda direta (A003 - Anticrise Completo) vinculada a uma R1.
 * Métrica irmã de Contrato Pago: NÃO move etapa do Kanban, NÃO marca contrato pago
 * e não toca em contract_paid_at nem em caucoes_efetivas.
 */
export type VendaDiretaSemVinculo = VendaSemVinculo;
export type VendaDiretaVinculada = VendaVinculada;

export function useVendasDiretasSemVinculo(attendeeId?: string | null, busca?: string) {
  const termo = (busca || '').trim();
  return useQuery({
    queryKey: ['vendas-diretas-sem-vinculo', attendeeId, termo],
    enabled: !!attendeeId,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<VendaDiretaSemVinculo[]> => {
      const { data, error } = await supabase.rpc('get_vendas_diretas_sem_vinculo' as any, {
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

export function useVendasDiretasDoParticipante(attendeeId?: string | null) {
  return useQuery({
    queryKey: ['vendas-diretas-do-participante', attendeeId],
    enabled: !!attendeeId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<VendaDiretaVinculada[]> => {
      const { data, error } = await supabase.rpc('get_vendas_diretas_do_participante' as any, {
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
  ['vendas-diretas-sem-vinculo', 'vendas-diretas-do-participante', 'agenda-meetings',
   'r1-closer-metrics', 'lead-full-timeline', 'deal-activities'].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] })
  );
}

export function useVincularVendaDireta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, attendeeId }: { transactionId: string; attendeeId: string }) => {
      const { data, error } = await supabase.rpc('vincular_venda_direta_r1' as any, {
        p_transaction_id: transactionId,
        p_attendee_id: attendeeId,
      });
      if (error) throw error;
      return data as { ok: boolean; deal_id?: string | null; produto?: string | null; liquido?: number; bruto?: number; gateway?: string | null };
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success('Venda direta vinculada à R1. (Não é contrato pago.)');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Não foi possível vincular a venda direta');
    },
  });
}

export function useDesvincularVendaDireta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase.rpc('desvincular_venda_direta' as any, {
        p_transaction_id: transactionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success('Venda direta desvinculada.');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Não foi possível desvincular a venda direta');
    },
  });
}
