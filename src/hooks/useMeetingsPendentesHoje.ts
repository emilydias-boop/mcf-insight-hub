import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export function useMeetingsPendentesHoje(buFilter?: string) {
  const today = new Date();

  return useQuery({
    queryKey: ["meetings-pendentes-hoje", today.toDateString(), buFilter],
    queryFn: async () => {
      const startISO = startOfDay(today).toISOString();
      const endISO = endOfDay(today).toISOString();

      // If buFilter provided, fetch closer IDs for that BU first
      let closerIdsForBU: Set<string> | null = null;
      if (buFilter) {
        const { data: closers } = await supabase
          .from("closers")
          .select("id")
          .eq("bu", buFilter);
        closerIdsForBU = new Set((closers || []).map(c => c.id));
      }

      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer_id)
        `)
        .gte("meeting_slot.scheduled_at", startISO)
        .lte("meeting_slot.scheduled_at", endISO)
        .eq("meeting_slot.meeting_type", "r1");

      if (error) throw error;

      let attendees = (data || []).filter(a => !a.is_partner);

      // Filter by BU if needed
      if (closerIdsForBU) {
        attendees = attendees.filter(a => {
          const closerId = (a.meeting_slot as any)?.closer_id;
          return closerId && closerIdsForBU!.has(closerId);
        });
      }

      // Pendentes = leads with status indicating "hasn't happened yet"
      const pendentes = attendees.filter(
        (a) => ["scheduled", "invited", "rescheduled"].includes(a.status || "")
      );

      return pendentes.length;
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}
