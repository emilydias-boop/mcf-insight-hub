import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export interface AgendamentosCreatedKPIs {
  totalAgendamentos: number;
}

export function useAgendamentosCreatedToday(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["agendamentos-created", startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<AgendamentosCreatedKPIs> => {
      const startISO = startOfDay(startDate).toISOString();
      const endISO = endOfDay(endDate).toISOString();

      // Conta attendees CRIADOS no período (ação de agendar)
      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select("id, status")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .neq("status", "cancelled");

      if (error) throw error;

      return {
        totalAgendamentos: data?.length || 0,
      };
    },
    staleTime: 30 * 1000,
  });
}
