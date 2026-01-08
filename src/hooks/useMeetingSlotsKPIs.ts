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

      const { data, error } = await supabase
        .from("meeting_slots")
        .select("status")
        .gte("scheduled_at", startISO)
        .lte("scheduled_at", endISO);

      if (error) {
        console.error("Error fetching meeting slots KPIs:", error);
        throw error;
      }

      const slots = data || [];

      const totalAgendadas = slots.filter(
        (s) => s.status === "scheduled" || s.status === "rescheduled"
      ).length;

      const totalRealizadas = slots.filter(
        (s) => s.status === "completed"
      ).length;

      const totalNoShows = slots.filter(
        (s) => s.status === "no_show"
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
