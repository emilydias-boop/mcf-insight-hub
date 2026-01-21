import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export function useMeetingsPendentesHoje() {
  const today = new Date();

  return useQuery({
    queryKey: ["meetings-pendentes-hoje", today.toDateString()],
    queryFn: async () => {
      const startISO = startOfDay(today).toISOString();
      const endISO = endOfDay(today).toISOString();

      console.log("[Pendentes Hoje] Buscando de", startISO, "até", endISO);

      // Query meeting_slot_attendees (same source as R1 Agendada KPI)
      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          meeting_slot:meeting_slots!inner(scheduled_at)
        `)
        .gte("meeting_slot.scheduled_at", startISO)
        .lte("meeting_slot.scheduled_at", endISO);

      if (error) throw error;

      console.log("[Pendentes Hoje] Total attendees:", data?.length);
      console.log("[Pendentes Hoje] Por status:", 
        data?.reduce((acc, a) => {
          acc[a.status || 'null'] = (acc[a.status || 'null'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // Pendentes = leads with status indicating "hasn't happened yet"
      const pendentes = (data || []).filter(
        (a) => ["scheduled", "invited", "rescheduled"].includes(a.status || "")
      );

      console.log("[Pendentes Hoje] Resultado final:", pendentes.length);

      return pendentes.length;
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
