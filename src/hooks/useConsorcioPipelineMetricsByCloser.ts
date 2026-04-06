import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PROPOSTA_ENVIADA_STAGE_ID = "09a0a99e-feee-46df-a817-bc4d0e1ac3d9";

/**
 * Counts "Proposta Enviada" per Closer within the given date range.
 * Links deal → meeting_slot_attendees → meeting_slots to find closer_id.
 * Returns Map<closerId, count>
 */
export function useConsorcioPipelineMetricsByCloser(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-propostas-by-closer", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Get deals that moved to "Proposta Enviada" in the period
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, owner_id")
        .eq("stage_id", PROPOSTA_ENVIADA_STAGE_ID)
        .gte("stage_moved_at", startDate.toISOString())
        .lte("stage_moved_at", endDate.toISOString());

      if (error) throw error;

      const dealIds = (data || []).map((d) => d.id);
      if (dealIds.length === 0) return new Map<string, number>();

      // Find closer via meeting_slot_attendees → meeting_slots
      const { data: rawAttendees, error: attError } = await supabase
        .from("meeting_slot_attendees")
        .select("deal_id, meeting_slot_id")
        .in("deal_id", dealIds);

      if (attError) throw attError;

      const attendees = (rawAttendees || []) as { deal_id: string; meeting_slot_id: string }[];
      const slotIds = [...new Set(attendees.map((a) => a.meeting_slot_id))];
      if (slotIds.length === 0) return new Map<string, number>();

      const { data: slots, error: slotsError } = await supabase
        .from("meeting_slots")
        .select("id, closer_id")
        .in("id", slotIds);

      if (slotsError) throw slotsError;

      // Build deal → closer map
      const slotCloserMap = new Map<string, string>();
      (slots || []).forEach((s) => {
        if (s.closer_id) slotCloserMap.set(s.id, s.closer_id);
      });

      const dealCloserMap = new Map<string, string>();
      attendees.forEach((a) => {
        const closerId = slotCloserMap.get(a.meeting_slot_id);
        if (closerId && a.deal_id) dealCloserMap.set(a.deal_id, closerId);
      });

      // Count propostas by closer
      const map = new Map<string, number>();
      (data || []).forEach((deal) => {
        const closerId = dealCloserMap.get(deal.id);
        if (!closerId) return;
        map.set(closerId, (map.get(closerId) || 0) + 1);
      });

      return map;
    },
  });
}
