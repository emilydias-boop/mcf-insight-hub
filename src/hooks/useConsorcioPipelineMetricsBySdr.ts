import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PROPOSTA_ENVIADA_STAGE_ID = "09a0a99e-feee-46df-a817-bc4d0e1ac3d9";

export function useConsorcioPipelineMetricsBySdr(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-propostas-by-sdr", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("owner_id")
        .eq("stage_id", PROPOSTA_ENVIADA_STAGE_ID)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());

      if (error) throw error;

      const map = new Map<string, number>();
      (data || []).forEach((deal) => {
        if (!deal.owner_id) return;
        const email = deal.owner_id.toLowerCase();
        map.set(email, (map.get(email) || 0) + 1);
      });
      return map;
    },
  });
}
