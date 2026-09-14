import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SugestaoVinculo } from './useSugestoesVinculoContrato';

interface AtribuirParams {
  sugestao: SugestaoVinculo;
  bu?: string;
}

/**
 * Grava a atribuição de um contrato órfão ao closer da reunião que já existia.
 *
 * Escopo autorizado (decisão do dono, 14/09/2026 — "alternativa A"):
 *   1. preenche hubla_transactions.linked_deal_id / linked_attendee_id APENAS
 *      quando nulos — isso tira a linha da lista de órfãos;
 *   2. insere uma linha em manual_sale_attributions com o closer escolhido —
 *      isso dá o crédito do contrato ao closer.
 * As duas escritas são encadeadas: se a segunda falhar, a primeira é desfeita.
 *
 * Propositalmente NÃO faz: escrever contract_paid_at em meeting_slot_attendees,
 * mudar status de attendee, mover etapa de negócio, chamar edge function
 * nenhuma. Nada financeiro é alterado.
 */
export function useAtribuirVinculoContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sugestao, bu = 'incorporador' }: AtribuirParams) => {
      // ---- Estado atual da transação — só órfã pode ser atribuída. ----
      const { data: tx, error: txError } = await supabase
        .from('hubla_transactions')
        .select('id, linked_deal_id, linked_attendee_id, customer_name, customer_email, customer_phone, sale_date')
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada — entre novamente para atribuir.');

      // ---- Escrita 1: vínculo, só no que está nulo. ----
      const payload: Record<string, unknown> = {
        linked_attendee_id: sugestao.attendee_id,
        linked_method: 'manual_sugestao',
        linked_at: new Date().toISOString(),
        linked_by_user_id: user.id,
      };
      const preencheuDeal = !tx.linked_deal_id;
      if (preencheuDeal) payload.linked_deal_id = sugestao.deal_id;

      const { error: updError } = await supabase
        .from('hubla_transactions')
        .update(payload)
        .eq('id', sugestao.transaction_id)
        .is('linked_attendee_id', null);

      if (updError) throw updError;

      // ---- Escrita 2: crédito ao closer. ----
      const contractPaidAt = tx.sale_date ?? sugestao.sale_date ?? new Date().toISOString();
      const notes = [
        `Atribuição manual a partir do modal de contratos não atribuídos.`,
        `Critério: ${sugestao.criterio} (confiança ${sugestao.forca}).`,
        `Reunião: ${sugestao.meeting_type || 'r1'} de ${sugestao.scheduled_at || 'data desconhecida'}`,
        `status do participante: ${sugestao.status_attendee || 'sem status'}.`,
        `Transação: ${sugestao.transaction_id}.`,
      ].join(' ');

      const { data: atribuicao, error: attrError } = await supabase
        .from('manual_sale_attributions' as any)
        .insert({
          closer_id: sugestao.closer_id,
          deal_id: sugestao.deal_id,
          business_unit: bu,
          contract_paid_at: contractPaidAt,
          contact_name: tx.customer_name || sugestao.customer_name || '(sem nome)',
          contact_email: tx.customer_email,
          contact_phone: tx.customer_phone,
          notes,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (attrError) {
        // Desfaz a escrita 1 — nada de vínculo sem crédito.
        const revert: Record<string, unknown> = {
          linked_attendee_id: null,
          linked_method: null,
          linked_at: null,
          linked_by_user_id: null,
        };
        if (preencheuDeal) revert.linked_deal_id = null;
        await supabase.from('hubla_transactions').update(revert).eq('id', sugestao.transaction_id);
        throw new Error(
          `Não foi possível registrar o crédito do closer, então o vínculo foi desfeito. (${attrError.message})`,
        );
      }

      // ---- Rastro. ----
      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: user.id,
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
          manual_sale_attribution_id: (atribuicao as any)?.id ?? null,
          closer_id: sugestao.closer_id,
          closer_name: sugestao.closer_name,
          criterio: sugestao.criterio,
          forca: sugestao.forca,
          scheduled_at: sugestao.scheduled_at,
          status_attendee: sugestao.status_attendee,
          contract_paid_at: contractPaidAt,
          customer_name: tx.customer_name,
        },
      });
      if (auditError) console.error('[audit_logs] falha ao registrar vínculo', auditError);

      return sugestao;
    },
    onSuccess: (sugestao) => {
      [
        'unassigned-contracts',
        'sugestoes-vinculo-contrato',
        'atribuicoes-manuais-periodo',
        'r1-closer-metrics',
        'sdr-metrics-agenda',
        'caucoes-efetivas',
        'closer-detail',
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(`Contrato atribuído a ${sugestao.closer_name || 'closer da reunião'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível atribuir o contrato');
    },
  });
}
