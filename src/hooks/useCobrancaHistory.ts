import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CobrancaHistoryItem {
  id: string;
  installment_id: string | null;
  billing_installment_id: string | null;
  subscription_id: string | null;
  tipo_acao: string;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
  // Enriched
  label: string;
  sublabel?: string;
  numero_parcela?: number;
  valor?: number;
  data_vencimento?: string;
}

export function useCobrancaHistory(type: 'consorcio' | 'billing', limit = 50) {
  return useQuery({
    queryKey: ['cobranca-history', type, limit],
    queryFn: async (): Promise<CobrancaHistoryItem[]> => {
      if (type === 'consorcio') {
        const { data, error } = await supabase
          .from('cobranca_acoes')
          .select(`
            id, installment_id, billing_installment_id, subscription_id,
            tipo_acao, observacao, created_at, created_by,
            consortium_installments!cobranca_acoes_installment_id_fkey(
              numero_parcela, valor_parcela, data_vencimento,
              consortium_cards!consortium_installments_card_id_fkey(
                nome_completo, grupo, cota
              )
            )
          `)
          .not('installment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return (data || []).map(row => {
          const inst = row.consortium_installments as any;
          const card = inst?.consortium_cards;
          return {
            id: row.id,
            installment_id: row.installment_id,
            billing_installment_id: row.billing_installment_id,
            subscription_id: row.subscription_id,
            tipo_acao: row.tipo_acao,
            observacao: row.observacao,
            created_at: row.created_at,
            created_by: row.created_by,
            label: card?.nome_completo || 'Sem nome',
            sublabel: [card?.grupo, card?.cota].filter(Boolean).join('/') || undefined,
            numero_parcela: inst?.numero_parcela,
            valor: inst?.valor_parcela ? Number(inst.valor_parcela) : undefined,
            data_vencimento: inst?.data_vencimento,
          };
        });
      } else {
        const { data, error } = await supabase
          .from('cobranca_acoes')
          .select(`
            id, installment_id, billing_installment_id, subscription_id,
            tipo_acao, observacao, created_at, created_by,
            billing_installments!cobranca_acoes_billing_installment_id_fkey(
              numero_parcela, valor_original, data_vencimento,
              billing_subscriptions!billing_installments_subscription_id_fkey(
                customer_name, product_name
              )
            )
          `)
          .not('billing_installment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return (data || []).map(row => {
          const inst = row.billing_installments as any;
          const sub = inst?.billing_subscriptions;
          return {
            id: row.id,
            installment_id: row.installment_id,
            billing_installment_id: row.billing_installment_id,
            subscription_id: row.subscription_id,
            tipo_acao: row.tipo_acao,
            observacao: row.observacao,
            created_at: row.created_at,
            created_by: row.created_by,
            label: sub?.customer_name || 'Sem nome',
            sublabel: sub?.product_name || undefined,
            numero_parcela: inst?.numero_parcela,
            valor: inst?.valor_original ? Number(inst.valor_original) : undefined,
            data_vencimento: inst?.data_vencimento,
          };
        });
      }
    },
  });
}
