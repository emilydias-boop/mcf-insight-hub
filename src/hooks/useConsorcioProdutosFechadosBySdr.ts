import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts total deal_produtos_adquiridos per SDR (owner_id from crm_deals)
 * within the given date range.
 * Returns Map<sdrEmail (lowercase), count>
 */
export function useConsorcioProdutosFechadosBySdr(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-produtos-fechados-by-sdr", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Fetch deal_produtos_adquiridos in the period, joining with crm_deals to get owner
      const { data, error } = await supabase
        .from("deal_produtos_adquiridos" as any)
        .select("id, deal_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const records = (data || []) as unknown as { id: string; deal_id: string; created_at: string }[];
      if (records.length === 0) return new Map<string, number>();

      // Get unique deal_ids
      const dealIds = [...new Set(records.map((r) => r.deal_id))];

      // Fetch owner_id for those deals
      const { data: deals, error: dealsError } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("id", dealIds);

      if (dealsError) throw dealsError;

      const dealOwnerMap = new Map<string, string>();
      (deals || []).forEach((d) => {
        if (d.owner_id) dealOwnerMap.set(d.id, d.owner_id.toLowerCase());
      });

      // Count produtos by SDR
      const map = new Map<string, number>();
      records.forEach((r) => {
        const sdrEmail = dealOwnerMap.get(r.deal_id);
        if (!sdrEmail) return;
        map.set(sdrEmail, (map.get(sdrEmail) || 0) + 1);
      });

      return map;
    },
  });
}
