import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export function useMeetingsPendentesHoje() {
  const today = new Date();

  return useQuery({
    queryKey: ["meetings-pendentes-hoje", today.toDateString()],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("meeting_slots")
        .select("id")
        .gte("scheduled_at", now.toISOString()) // A partir de agora
        .lte("scheduled_at", endOfDay(today).toISOString()) // Até fim do dia
        .in("status", ["scheduled", "invited", "rescheduled"]);

      if (error) throw error;
      return data?.length || 0;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Auto-refresh a cada 1 minuto
  });
}
