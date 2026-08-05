import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IcpSegment = 'A' | 'B';
export type IcpSegmentFilterValue = 'all' | IcpSegment;

/**
 * Busca em lote o segmento ICP (crm_deals.icp_segment) de uma lista de deal_ids.
 * Aditivo: usado apenas quando um filtro de segmento está ativo.
 */
export function useDealsIcpSegments(dealIds: string[], enabled: boolean) {
  const ids = Array.from(new Set(dealIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ['deals-icp-segments', ids.length, ids.slice(0, 50).join(',')],
    enabled: enabled && ids.length > 0,
    staleTime: 60000,
    queryFn: async (): Promise<Map<string, IcpSegment | null>> => {
      const map = new Map<string, IcpSegment | null>();
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data, error } = await (supabase.from('crm_deals') as any)
          .select('id, icp_segment')
          .in('id', chunk);
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const v = (row.icp_segment ?? '').toString().trim().toUpperCase();
          map.set(row.id, v === 'A' || v === 'B' ? (v as IcpSegment) : null);
        });
      }
      return map;
    },
  });
}
