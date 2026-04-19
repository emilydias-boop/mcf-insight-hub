import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONSORCIO_PROPOSTA_STAGE_IDS } from "@/lib/consorcioStages";

/**
 * Counts "Propostas Enviadas" per Closer within the given date range.
 * Sources (DISTINCT by deal_id):
 *  (a) consorcio_proposals (created via aba Pós-Reunião)
 *  (b) Deals moved to stage PROPOSTA ENVIADA (VdA) in period
 * Mapping: crm_deals.owner_id (email) → closers.email, fallback meeting_slot_attendees.
 * Returns Map<closerId, count>
 */
export function useConsorcioPipelineMetricsByCloser(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-propostas-by-closer-v2", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Active closers map (email lowercase → id)
      const { data: closers, error: closersError } = await supabase
        .from("closers")
        .select("id, email")
        .eq("is_active", true);
      if (closersError) throw closersError;

      const emailToCloserId = new Map<string, string>();
      (closers || []).forEach((c) => {
        if (c.email) emailToCloserId.set(c.email.toLowerCase(), c.id);
      });

      // (a) consorcio_proposals in period
      const { data: proposals, error: pError } = await supabase
        .from("consorcio_proposals")
        .select("deal_id, created_by")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (pError) throw pError;

      // Resolve created_by → closer via profiles.email
      const creatorIds = [...new Set((proposals || []).map((p) => p.created_by).filter(Boolean) as string[])];
      const profileToCloserId = new Map<string, string>();
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", creatorIds);
        (profs || []).forEach((p) => {
          if (p.email) {
            const cid = emailToCloserId.get(p.email.toLowerCase());
            if (cid) profileToCloserId.set(p.id, cid);
          }
        });
      }

      // (b) Deals in stage PROPOSTA ENVIADA in period
      const { data: deals, error: dError } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .in("stage_id", CONSORCIO_PROPOSTA_STAGE_IDS)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());
      if (dError) throw dError;

      // dealId → closerId resolution (owner email → fallback meeting_slot)
      const dealCloserMap = new Map<string, string>();
      const dealsNeedingFallback: string[] = [];

      (deals || []).forEach((d) => {
        if (d.owner_id) {
          const cid = emailToCloserId.get(d.owner_id.toLowerCase());
          if (cid) {
            dealCloserMap.set(d.id, cid);
            return;
          }
        }
        dealsNeedingFallback.push(d.id);
      });

      // Also need closer for deals coming from proposals (when proposal.created_by didn't resolve)
      const proposalsNeedingDealLookup = (proposals || [])
        .filter((p) => p.deal_id && !(p.created_by && profileToCloserId.has(p.created_by)))
        .map((p) => p.deal_id as string);

      const allFallbackDealIds = [...new Set([...dealsNeedingFallback, ...proposalsNeedingDealLookup])];

      if (allFallbackDealIds.length > 0) {
        // Try owner_id direct on these deals first (for proposals fallback)
        const { data: fbDeals } = await supabase
          .from("crm_deals")
          .select("id, owner_id")
          .in("id", allFallbackDealIds);
        const stillNeedSlot: string[] = [];
        (fbDeals || []).forEach((d) => {
          if (dealCloserMap.has(d.id)) return;
          if (d.owner_id) {
            const cid = emailToCloserId.get(d.owner_id.toLowerCase());
            if (cid) {
              dealCloserMap.set(d.id, cid);
              return;
            }
          }
          stillNeedSlot.push(d.id);
        });

        if (stillNeedSlot.length > 0) {
          const { data: rawAtt } = await supabase
            .from("meeting_slot_attendees")
            .select("deal_id, meeting_slot_id")
            .in("deal_id", stillNeedSlot);
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
      }

      // Aggregate DISTINCT deal_id per closer
      const closerDealSet = new Map<string, Set<string>>();
      const addDealForCloser = (closerId: string, dealId: string) => {
        if (!closerDealSet.has(closerId)) closerDealSet.set(closerId, new Set());
        closerDealSet.get(closerId)!.add(dealId);
      };

      // From proposals
      (proposals || []).forEach((p) => {
        if (!p.deal_id) return;
        let cid: string | undefined;
        if (p.created_by) cid = profileToCloserId.get(p.created_by);
        if (!cid) cid = dealCloserMap.get(p.deal_id);
        if (cid) addDealForCloser(cid, p.deal_id);
      });

      // From stage moves
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
