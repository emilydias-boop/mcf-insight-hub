import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONSORCIO_FECHAMENTO_STAGE_IDS } from "@/lib/consorcioStages";

/**
 * Counts "Produtos Fechados" per SDR (owner_id email lowercase).
 * Sources (DISTINCT by deal_id):
 *  (a) deal_produtos_adquiridos in period
 *  (b) Deals in stages PRODUTOS FECHADOS / VENDA REALIZADA / CONTRATO PAGO / VENDA REALIZADA 50K
 * Returns Map<sdrEmailLower, count>
 */
export function useConsorcioProdutosFechadosBySdr(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-produtos-fechados-by-sdr-v2", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: rawProds, error } = await supabase
        .from("deal_produtos_adquiridos" as any)
        .select("deal_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (error) throw error;
      const prodRecords = (rawProds || []) as unknown as { deal_id: string }[];

      const { data: stageDeals, error: dError } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("stage_id", CONSORCIO_FECHAMENTO_STAGE_IDS)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());
      if (dError) throw dError;

      const allDealIds = [...new Set([
        ...prodRecords.map((r) => r.deal_id).filter(Boolean),
        ...(stageDeals || []).map((d) => d.id),
      ])];

      if (allDealIds.length === 0) return new Map<string, number>();

      // Get owner_id for all
      const { data: ownerDeals } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("id", allDealIds);

      const dealOwner = new Map<string, string>();
      (ownerDeals || []).forEach((d) => {
        if (d.owner_id) dealOwner.set(d.id, d.owner_id.toLowerCase());
      });

      // DISTINCT deal_id per sdr
      const sdrDeals = new Map<string, Set<string>>();
      const add = (sdr: string, dealId: string) => {
        if (!sdrDeals.has(sdr)) sdrDeals.set(sdr, new Set());
        sdrDeals.get(sdr)!.add(dealId);
      };

      const allDealIdsToCount = new Set<string>([
        ...prodRecords.map((r) => r.deal_id).filter(Boolean),
        ...(stageDeals || []).map((d) => d.id),
      ]);
      allDealIdsToCount.forEach((dealId) => {
        const sdr = dealOwner.get(dealId);
        if (sdr) add(sdr, dealId);
      });

      const result = new Map<string, number>();
      sdrDeals.forEach((set, sdr) => result.set(sdr, set.size));
      return result;
    },
  });
}
