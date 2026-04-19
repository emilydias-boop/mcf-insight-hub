import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONSORCIO_PROPOSTA_STAGE_IDS } from "@/lib/consorcioStages";

/**
 * Counts Propostas Enviadas per SDR (owner_id email lowercase).
 * Sources (DISTINCT by deal_id):
 *  (a) consorcio_proposals in period (mapped via deal owner)
 *  (b) Deals moved to stage PROPOSTA ENVIADA in period
 * Returns Map<sdrEmailLower, count>
 */
export function useConsorcioPipelineMetricsBySdr(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-propostas-by-sdr-v2", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: stageDeals, error } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("stage_id", CONSORCIO_PROPOSTA_STAGE_IDS)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());
      if (error) throw error;

      const { data: proposals, error: pError } = await supabase
        .from("consorcio_proposals")
        .select("deal_id")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (pError) throw pError;

      const proposalDealIds = (proposals || []).map((p) => p.deal_id).filter(Boolean) as string[];
      const stageDealIds = (stageDeals || []).map((d) => d.id);
      const allDealIds = [...new Set([...proposalDealIds, ...stageDealIds])];
      if (allDealIds.length === 0) return new Map<string, number>();

      const { data: ownerDeals } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("id", allDealIds);

      const dealOwner = new Map<string, string>();
      (ownerDeals || []).forEach((d) => {
        if (d.owner_id) dealOwner.set(d.id, d.owner_id.toLowerCase());
      });

      const sdrDeals = new Map<string, Set<string>>();
      allDealIds.forEach((dealId) => {
        const sdr = dealOwner.get(dealId);
        if (!sdr) return;
        if (!sdrDeals.has(sdr)) sdrDeals.set(sdr, new Set());
        sdrDeals.get(sdr)!.add(dealId);
      });

      const result = new Map<string, number>();
      sdrDeals.forEach((set, sdr) => result.set(sdr, set.size));
      return result;
    },
  });
}
