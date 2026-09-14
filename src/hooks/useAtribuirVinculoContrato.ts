import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SugestaoVinculo } from './useSugestoesVinculoContrato';

interface AtribuirParams {
  sugestao: SugestaoVinculo;
}

/**
 * Grava o vínculo entre uma transação de contrato órfã e a reunião que já
 * existia. Escopo autorizado e propositalmente mínimo:
 *  - preenche linked_deal_id / linked_attendee_id APENAS quando nulos;
 *  - nunca sobrescreve vínculo existente (erra em vez de corrigir por cima);
 *  - não toca em valor, data, status nem em nada financeiro;
 *  - toda gravação nasce de um clique e deixa rastro em audit_logs.
 */
export function useAtribuirVinculoContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sugestao }: AtribuirParams) => {
      // 1. Estado atual da transação — só órfã pode ser atribuída.
      const { data: tx, error: txError } = await supabase
        .from('hubla_transactions')
        .select('id, linked_deal_id, linked_attendee_id, customer_name')
        .eq('id', sugestao.transaction_id)
        .maybeSingle();

      if (txError) throw txError;
      if (!tx) throw new Error('Transação não encontrada.');
      if (tx.linked_attendee_id) {
        throw new Error(
          'Esta transação já está vinculada a uma reunião — ela não deveria aparecer como órfã. Nada foi alterado.',
        );
      }
      if (tx.linked_deal_id && tx.linked_deal_id !== sugestao.deal_id) {
        throw new Error(
          'Esta transação já aponta para outro negócio. Não sobrescrevemos vínculo existente — nada foi alterado.',
        );
      }

      // 2. Preenche apenas o que está nulo.
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        linked_attendee_id: sugestao.attendee_id,
        linked_method: 'manual_sugestao',
        linked_at: new Date().toISOString(),
        linked_by_user_id: user?.id ?? null,
      };
      if (!tx.linked_deal_id) payload.linked_deal_id = sugestao.deal_id;

      const { error: updError } = await supabase
        .from('hubla_transactions')
        .update(payload)
        .eq('id', sugestao.transaction_id)
        .is('linked_attendee_id', null);

      if (updError) throw updError;

      // 3. Rastro.
      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: user?.id ?? null,
        action: 'contrato_vinculo_atribuido',
        table_name: 'hubla_transactions',
        record_id: sugestao.transaction_id,
        old_data: {
          linked_deal_id: tx.linked_deal_id,
          linked_attendee_id: tx.linked_attendee_id,
        },
        new_data: {
          linked_deal_id: sugestao.deal_id,
          linked_attendee_id: sugestao.attendee_id,
          closer_id: sugestao.closer_id,
          closer_name: sugestao.closer_name,
          criterio: sugestao.criterio,
          forca: sugestao.forca,
          scheduled_at: sugestao.scheduled_at,
          status_attendee: sugestao.status_attendee,
          customer_name: tx.customer_name,
        },
      });
      if (auditError) console.error('[audit_logs] falha ao registrar vínculo', auditError);

      return sugestao;
    },
    onSuccess: (sugestao) => {
      ['unassigned-contracts', 'sugestoes-vinculo-contrato', 'r1-closer-metrics', 'sdr-metrics-agenda', 'caucoes-efetivas', 'closer-detail']
        .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(`Contrato atribuído a ${sugestao.closer_name || 'closer da reunião'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível atribuir o contrato');
    },
  });
}
