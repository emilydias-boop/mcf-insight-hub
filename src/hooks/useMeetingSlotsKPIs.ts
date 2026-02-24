import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export interface MeetingSlotsKPIs {
  totalAgendadas: number;      // scheduled + rescheduled
  totalRealizadas: number;     // completed
  totalNoShows: number;        // no_show
}

export function useMeetingSlotsKPIs(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["meeting-slots-kpis", startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<MeetingSlotsKPIs> => {
      const startISO = startOfDay(startDate).toISOString();
      const endISO = endOfDay(endDate).toISOString();

      // Query meeting_slot_attendees with JOIN to meeting_slots for scheduled_at filter
      // This ensures R1 Realizada/No-Show only counts button clicks, not webhook stage changes
      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
        `)
        .gte("meeting_slot.scheduled_at", startISO)
        .lte("meeting_slot.scheduled_at", endISO)
        .eq("meeting_slot.meeting_type", "r1");

      if (error) {
        console.error("Error fetching meeting slot attendees KPIs:", error);
        throw error;
      }

      // Filter out partners from metrics
      const attendees = (data || []).filter((a) => !a.is_partner);

      // R1 Agendada: ALL attendees that were scheduled for the period (excludes only cancelled)
      // This keeps the count stable as meetings are marked completed/no_show
      const totalAgendadas = attendees.filter(
        (a) => a.status !== "cancelled"
      ).length;

      // R1 Realizada: completed OR contract_paid OR refunded (paid = meeting happened)
      const totalRealizadas = attendees.filter(
        (a) => a.status === "completed" || a.status === "contract_paid" || a.status === "refunded"
      ).length;

      // No-Show: ONLY from "No-Show" button clicks (status = no_show)
      const totalNoShows = attendees.filter(
        (a) => a.status === "no_show"
      ).length;

      return {
        totalAgendadas,
        totalRealizadas,
        totalNoShows,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
