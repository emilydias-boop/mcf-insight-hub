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

      // Query meeting_slots for R2 meetings (meeting_type = 'r2')
      const { data, error } = await supabase
        .from("meeting_slots")
        .select("id, status")
        .eq("meeting_type", "r2")
        .gte("scheduled_at", startISO)
        .lte("scheduled_at", endISO);

      if (error) {
        console.error("Error fetching R2 meeting slots KPIs:", error);
        throw error;
      }

      const slots = data || [];

      // R2 Agendadas: ALL slots that were scheduled for the period (excludes only cancelled)
      const r2Agendadas = slots.filter(
        (s) => s.status !== "cancelled"
      ).length;

      // R2 Realizadas: ONLY completed meetings (status = completed)
      const r2Realizadas = slots.filter(
        (s) => s.status === "completed"
      ).length;

      return {
        r2Agendadas,
        r2Realizadas,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
