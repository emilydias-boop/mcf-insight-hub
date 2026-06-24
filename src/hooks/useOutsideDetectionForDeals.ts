import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Outside detection — migrado para RPC server-side (get_outside_detection_for_deals).
 *
 * Substitui as 5 queries + dezenas/centenas de round-trips do hook anterior por
 * uma única chamada RPC que reproduz fielmente as 5 regras:
 *   1. contracts (product_category in contrato/incorporador + ilike '%contrato%' + completed)
 *   2. nonContractProducts (NOT ilike '%contrato%' + completed) — para display name
 *   3. R1 attendees (meeting_type='r1') — cross-pipeline via email
 *   4. partner products (A001-A009/INCORPORADOR/ANTICRISE) — disqualifica
 *   5. CLS contracts (offer_name ilike 'Contrato CLS%') — disqualifica
 *
 * Interface mantida igual ao hook anterior:
 *   Map<dealId, { isOutside: boolean; productName: string | null }>
 *
 * NOTA conhecida (aceita como tolerável): em contatos com múltiplas compras
 * "outside" no mesmo sale_date, o productName exibido pode variar entre RPC e
 * a versão TS anterior — nenhum dos dois lados tem critério de desempate
 * determinístico para esse caso. O is_outside bate 100% (validado em
 * /admin/outside-detection-diff sobre amostra de 300 deals).
 */
interface DealForOutsideCheck {
  id: string;
  created_at?: string;
  crm_contacts?: {
    email?: string | null;
  } | null;
}

interface RpcRow {
  deal_id: string;
  is_outside: boolean;
  product_name: string | null;
}

export const useOutsideDetectionForDeals = (deals: DealForOutsideCheck[]) => {
  const keyParts = deals.map(d => `${d.id}:${d.crm_contacts?.email || ''}`).join(',');

  return useQuery({
    queryKey: ['outside-detection-deals', keyParts],
    queryFn: async (): Promise<Map<string, { isOutside: boolean; productName: string | null }>> => {
      const result = new Map<string, { isOutside: boolean; productName: string | null }>();
      if (!deals.length) return result;

      const dealIds = deals.map(d => d.id);

      const { data, error } = await supabase.rpc('get_outside_detection_for_deals', {
        p_deal_ids: dealIds,
      });

      if (error) throw error;

      for (const row of (data || []) as RpcRow[]) {
        if (row.is_outside) {
          result.set(row.deal_id, {
            isOutside: true,
            productName: row.product_name,
          });
        }
      }

      return result;
    },
    enabled: deals.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: (previousData) => previousData,
  });
};
