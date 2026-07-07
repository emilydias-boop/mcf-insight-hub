import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sum of valor_credito (from consorcio_proposals) attributed per closer within a period.
 *
 * Attribution priority for each proposal:
 *   1. proposals.created_by → profiles.email → closers.email
 *   2. deal owner_id (email) → closers.email
 *   3. meeting_slots.closer_id via meeting_slot_attendees.deal_id
 *
 * Returns Map<closerId, valorTotal>.
 */
export function useConsorcioRealizadoByCloser(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-realizado-by-closer", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: closers, error: cErr } = await supabase
        .from("closers")
        .select("id, email, bu")
        .eq("is_active", true);
      if (cErr) throw cErr;
      const emailToCloserId = new Map<string, string>();
      (closers || []).forEach((c) => {
        if (c.email) emailToCloserId.set(c.email.toLowerCase(), c.id);
      });

      const { data: proposals, error: pErr } = await supabase
        .from("consorcio_proposals")
        .select("deal_id, created_by, valor_credito, proposal_date, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (pErr) throw pErr;

      const list = proposals || [];
      if (list.length === 0) return new Map<string, number>();

      // 1) created_by → profile email → closer
      const creatorIds = [...new Set(list.map((p) => p.created_by).filter(Boolean) as string[])];
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

      // 2) deal.owner_id → closer (for unresolved proposals)
      const unresolvedDealIds = [
        ...new Set(
          list
            .filter((p) => p.deal_id && !(p.created_by && profileToCloserId.has(p.created_by)))
            .map((p) => p.deal_id as string)
        ),
      ];
      const dealCloserMap = new Map<string, string>();
      const stillNeedSlot: string[] = [];
      if (unresolvedDealIds.length > 0) {
        const { data: deals } = await supabase
          .from("crm_deals")
          .select("id, owner_id")
          .in("id", unresolvedDealIds);
        (deals || []).forEach((d) => {
          if (d.owner_id) {
            const cid = emailToCloserId.get(d.owner_id.toLowerCase());
            if (cid) {
              dealCloserMap.set(d.id, cid);
              return;
            }
          }
          stillNeedSlot.push(d.id);
        });

        // 3) meeting_slot fallback
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

      // Aggregate valor_credito per closer
      const result = new Map<string, number>();
      for (const p of list) {
        const v = Number(p.valor_credito || 0);
        if (!v) continue;
        let cid: string | undefined;
        if (p.created_by) cid = profileToCloserId.get(p.created_by);
        if (!cid && p.deal_id) cid = dealCloserMap.get(p.deal_id);
        if (!cid) continue;
        result.set(cid, (result.get(cid) || 0) + v);
      }
      return result;
    },
  });
}
