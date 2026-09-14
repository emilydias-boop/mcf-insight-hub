import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface AtribuicaoManual {
  id: string;
  closer_id: string;
  closer_name: string | null;
  deal_id: string | null;
  contact_name: string;
  contract_paid_at: string;
  notes: string | null;
  created_at: string | null;
}

/** Atribuições manuais já gravadas no período — base do "desfazer". */
export function useAtribuicoesManuaisPeriodo(
  startDate: Date,
  endDate: Date,
  bu: string = 'incorporador',
  enabled = true,
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['atribuicoes-manuais-periodo', start, end, bu],
    enabled,
    queryFn: async (): Promise<AtribuicaoManual[]> => {
      const { data, error } = await supabase
        .from('manual_sale_attributions' as any)
        .select('id, closer_id, deal_id, contact_name, contract_paid_at, notes, created_at, closers:closer_id(name)')
        .eq('business_unit', bu)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', `${end}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        id: r.id,
        closer_id: r.closer_id,
        closer_name: r.closers?.name ?? null,
        deal_id: r.deal_id ?? null,
        contact_name: r.contact_name,
        contract_paid_at: r.contract_paid_at,
        notes: r.notes ?? null,
        created_at: r.created_at ?? null,
      }));
    },
  });
}

/**
 * Desfaz uma atribuição manual: apaga a linha de crédito e, quando o vínculo
 * foi criado por esta mesma tela (linked_method = 'manual_sugestao'), devolve
 * linked_deal_id / linked_attendee_id para nulo. Não toca em valor, data,
 * status nem em nada financeiro.
 */
export function useDesfazerAtribuicaoManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (atribuicao: AtribuicaoManual) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Transação vinculada por esta tela, identificada pelo id gravado em notes.
      const match = atribuicao.notes?.match(/Transação: ([0-9a-f-]{36})/i);
      const transactionId = match?.[1] ?? null;

      const { error: delError } = await supabase
        .from('manual_sale_attributions' as any)
        .delete()
        .eq('id', atribuicao.id);
      if (delError) throw delError;

      if (transactionId) {
        await supabase
          .from('hubla_transactions')
          .update({
            linked_deal_id: null,
            linked_attendee_id: null,
            linked_method: null,
            linked_at: null,
            linked_by_user_id: null,
          })
          .eq('id', transactionId)
          .eq('linked_method', 'manual_sugestao');
      }

      await supabase.from('audit_logs').insert({
        user_id: user?.id ?? null,
        action: 'contrato_vinculo_desfeito',
        table_name: 'manual_sale_attributions',
        record_id: atribuicao.id,
        old_data: {
          closer_id: atribuicao.closer_id,
          deal_id: atribuicao.deal_id,
          contact_name: atribuicao.contact_name,
          contract_paid_at: atribuicao.contract_paid_at,
          notes: atribuicao.notes,
          transaction_id: transactionId,
        },
        new_data: null,
      });

      return atribuicao;
    },
    onSuccess: () => {
      [
        'unassigned-contracts',
        'sugestoes-vinculo-contrato',
        'atribuicoes-manuais-periodo',
        'r1-closer-metrics',
        'sdr-metrics-agenda',
        'caucoes-efetivas',
        'closer-detail',
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('Atribuição desfeita — o contrato voltou para a lista.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível desfazer a atribuição');
    },
  });
}
