import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingSubscription } from '@/types/billing';

export interface QueueItem {
  subscription: BillingSubscription;
  parcelas_atrasadas: number;
  dias_desde_ultimo_pagamento: number | null;
  ultima_acao_manual: string | null;
  dias_sem_contato: number | null;
  risco: 'cancelamento' | 'alto' | 'medio';
}

export const useBillingQueue = () => {
  return useQuery({
    queryKey: ['billing-queue'],
    queryFn: async () => {
      // 1. Get all overdue subscriptions
      const { data: subs, error: subsError } = await supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('status', 'atrasada')
        .order('updated_at', { ascending: false });
      if (subsError) throw subsError;

      const subscriptions = (subs || []) as unknown as BillingSubscription[];
      if (subscriptions.length === 0) return [] as QueueItem[];

      // 2. Count overdue installments per subscription
      const subIds = subscriptions.map(s => s.id);
      const overdueMap = new Map<string, number>();
      const lastPaidMap = new Map<string, string | null>();

      for (let i = 0; i < subIds.length; i += 200) {
        const chunk = subIds.slice(i, i + 200);
        const { data: instData, error: instError } = await supabase
          .from('billing_installments')
          .select('subscription_id, status, data_pagamento')
          .in('subscription_id', chunk);
        if (instError) throw instError;

        for (const row of (instData || [])) {
          if (row.status === 'atrasado') {
            overdueMap.set(row.subscription_id, (overdueMap.get(row.subscription_id) || 0) + 1);
          }
          if (row.status === 'pago' && row.data_pagamento) {
            const current = lastPaidMap.get(row.subscription_id);
            if (!current || row.data_pagamento > current) {
              lastPaidMap.set(row.subscription_id, row.data_pagamento);
            }
          }
        }
      }

      // 3. Get last manual action per subscription from billing_history
      const manualTypes = ['tentativa_cobranca', 'observacao', 'acordo_realizado'] as const;
      const lastActionMap = new Map<string, string>();

      for (let i = 0; i < subIds.length; i += 200) {
        const chunk = subIds.slice(i, i + 200);
        const { data: histData, error: histError } = await supabase
          .from('billing_history')
          .select('subscription_id, created_at, tipo')
          .in('subscription_id', chunk)
          .in('tipo', manualTypes)
          .order('created_at', { ascending: false });
        if (histError) throw histError;

        for (const row of (histData || [])) {
          if (!lastActionMap.has(row.subscription_id)) {
            lastActionMap.set(row.subscription_id, row.created_at);
          }
        }
      }

      // 4. Build queue items
      const now = new Date();
      const items: QueueItem[] = subscriptions
        .map(sub => {
          const parcelas_atrasadas = overdueMap.get(sub.id) || 0;
          const lastPaid = lastPaidMap.get(sub.id);
          const lastAction = lastActionMap.get(sub.id);

          const dias_desde_ultimo_pagamento = lastPaid
            ? Math.floor((now.getTime() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const dias_sem_contato = lastAction
            ? Math.floor((now.getTime() - new Date(lastAction).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const risco: QueueItem['risco'] = parcelas_atrasadas >= 4
            ? 'cancelamento'
            : parcelas_atrasadas >= 3
              ? 'alto'
              : 'medio';

          return {
            subscription: sub,
            parcelas_atrasadas,
            dias_desde_ultimo_pagamento,
            ultima_acao_manual: lastAction || null,
            dias_sem_contato,
            risco,
          };
        })
        .filter(item => item.parcelas_atrasadas > 0)
        .sort((a, b) => b.parcelas_atrasadas - a.parcelas_atrasadas);

      return items;
    },
  });
};

export const useBulkAssignResponsavel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, responsavel }: { ids: string[]; responsavel: string }) => {
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { error } = await supabase
          .from('billing_subscriptions')
          .update({ responsavel_financeiro: responsavel } as any)
          .in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-queue'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
    },
  });
};
