import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts total deal_produtos_adquiridos per Closer within the given date range.
 * Links deal → meeting_slot_attendees → meeting_slots to find closer_id.
 * Returns Map<closerId, count>
 */
export function useConsorcioProdutosFechadosByCloser(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["consorcio-produtos-fechados-by-closer", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_produtos_adquiridos" as any)
        .select("id, deal_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const records = (data || []) as unknown as { id: string; deal_id: string; created_at: string }[];
      if (records.length === 0) return new Map<string, number>();

      const dealIds = [...new Set(records.map((r) => r.deal_id))];

      // Find closer via meeting_slot_attendees → meeting_slots
      const { data: rawAttendees, error: attError } = await supabase
        .from("meeting_slot_attendees")
        .select("deal_id, meeting_slot_id")
        .in("deal_id", dealIds);

      if (attError) throw attError;

      const attendees = (rawAttendees || []) as unknown as { deal_id: string; meeting_slot_id: string }[];
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

      // Count produtos by closer
      const map = new Map<string, number>();
      records.forEach((r) => {
        const closerId = dealCloserMap.get(r.deal_id);
        if (!closerId) return;
        map.set(closerId, (map.get(closerId) || 0) + 1);
      });

      return map;
    },
  });
}
