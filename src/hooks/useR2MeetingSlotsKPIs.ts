import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export interface R2MeetingSlotsKPIs {
  r2Agendadas: number;    // R2 meetings scheduled (not cancelled)
  r2Realizadas: number;   // R2 meetings completed
}

export function useR2MeetingSlotsKPIs(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["r2-meeting-slots-kpis", startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<R2MeetingSlotsKPIs> => {
      const startISO = startOfDay(startDate).toISOString();
      const endISO = endOfDay(endDate).toISOString();

      // Query meeting_slot_attendees for R2 meetings (meeting_type = 'r2')
      // This counts each attendee correctly (slots can have multiple attendees)
      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
        `)
        .eq("meeting_slot.meeting_type", "r2")
        .gte("meeting_slot.scheduled_at", startISO)
        .lte("meeting_slot.scheduled_at", endISO);

      if (error) {
        console.error("Error fetching R2 meeting slots KPIs:", error);
        throw error;
      }

      // Filter out partners from metrics
      const attendees = (data || []).filter((a) => !a.is_partner);

      // R2 Agendadas: ALL attendees scheduled for the period (excludes only cancelled)
      const r2Agendadas = attendees.filter(
        (a) => a.status !== "cancelled" && a.status !== "rescheduled"
      ).length;

      // R2 Realizadas: completed OR contract_paid OR refunded
      const r2Realizadas = attendees.filter(
        (a) => a.status === "completed" || a.status === "contract_paid" || a.status === "refunded"
      ).length;

      return {
        r2Agendadas,
        r2Realizadas,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
