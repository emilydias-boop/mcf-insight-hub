import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONSORCIO_FECHAMENTO_STAGE_IDS } from "@/lib/consorcioStages";

/**
 * Counts "Produtos Fechados" per Closer within the given date range.
 * Sources (DISTINCT by deal_id):
 *  (a) deal_produtos_adquiridos (cota cadastrada via fluxo)
 *  (b) Deals moved to stages: PRODUTOS FECHADOS / VENDA REALIZADA / CONTRATO PAGO / VENDA REALIZADA 50K
 * Mapping: crm_deals.owner_id (email) → closers.email, fallback meeting_slot_attendees.
 * Returns Map<closerId, count>
 */
export function useConsorcioProdutosFechadosByCloser(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-produtos-fechados-by-closer-v2", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: closers, error: closersError } = await supabase
        .from("closers")
        .select("id, email")
        .eq("is_active", true);
      if (closersError) throw closersError;

      const emailToCloserId = new Map<string, string>();
      (closers || []).forEach((c) => {
        if (c.email) emailToCloserId.set(c.email.toLowerCase(), c.id);
      });

      // (a) deal_produtos_adquiridos in period
      const { data: rawProds, error: pError } = await supabase
        .from("deal_produtos_adquiridos" as any)
        .select("deal_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (pError) throw pError;
      const prodRecords = (rawProds || []) as unknown as { deal_id: string; created_at: string }[];

      // (b) Deals in fechamento stages in period
      const { data: deals, error: dError } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("stage_id", CONSORCIO_FECHAMENTO_STAGE_IDS)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());
      if (dError) throw dError;

      // Union of deal_ids needing closer resolution
      const allDealIds = [...new Set([
        ...prodRecords.map((r) => r.deal_id).filter(Boolean),
        ...(deals || []).map((d) => d.id),
      ])];

      if (allDealIds.length === 0) return new Map<string, number>();

      // Fetch owner_id for all
      const { data: ownerDeals } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("id", allDealIds);

      const dealCloserMap = new Map<string, string>();
      const needSlotFallback: string[] = [];
      (ownerDeals || []).forEach((d) => {
        if (d.owner_id) {
          const cid = emailToCloserId.get(d.owner_id.toLowerCase());
          if (cid) {
            dealCloserMap.set(d.id, cid);
            return;
          }
        }
        needSlotFallback.push(d.id);
      });

      if (needSlotFallback.length > 0) {
        const { data: rawAtt } = await supabase
          .from("meeting_slot_attendees")
          .select("deal_id, meeting_slot_id")
          .in("deal_id", needSlotFallback);
        const attendees = (rawAtt || []) as { deal_id: string; meeting_slot_id: string }[];
        const slotIds = [...new Set(attendees.map((a) => a.meeting_slot_id))];
        if (slotIds.length > 0) {
          const { data: slots } = await supabase
            .from("meeting_slots")
            .select("id, closer_id")
            .in("id", slotIds);
          const slotCloser = new Map<string, string>();
          (slots || []).forEach((s) => {
            if (s.closer_id) slotCloser.set(s.id, s.closer_id);
          });
          attendees.forEach((a) => {
            if (dealCloserMap.has(a.deal_id)) return;
            const cid = slotCloser.get(a.meeting_slot_id);
            if (cid) dealCloserMap.set(a.deal_id, cid);
          });
        }
      }

      // Aggregate DISTINCT deal_id per closer
      const closerDealSet = new Map<string, Set<string>>();
      const addDealForCloser = (closerId: string, dealId: string) => {
        if (!closerDealSet.has(closerId)) closerDealSet.set(closerId, new Set());
        closerDealSet.get(closerId)!.add(dealId);
      };

      prodRecords.forEach((r) => {
        const cid = dealCloserMap.get(r.deal_id);
        if (cid) addDealForCloser(cid, r.deal_id);
      });
      (deals || []).forEach((d) => {
        const cid = dealCloserMap.get(d.id);
        if (cid) addDealForCloser(cid, d.id);
      });

      const result = new Map<string, number>();
      closerDealSet.forEach((set, cid) => result.set(cid, set.size));
      return result;
    },
  });
}
