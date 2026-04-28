import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay } from "date-fns";

/**
 * Conta reuniões R1 cujo scheduled_at está no período (start..end),
 * já passaram (< hoje) e ainda estão com status "não atualizado"
 * (scheduled/invited/rescheduled). Filtra por BU via closer_id.
 */
export function useMeetingsSemStatus(
  startDate: Date | null,
  endDate: Date | null,
  buFilter?: string
) {
  return useQuery({
    queryKey: [
      "meetings-sem-status",
      startDate?.toISOString() ?? null,
      endDate?.toISOString() ?? null,
      buFilter ?? null,
    ],
    queryFn: async () => {
      if (!startDate || !endDate) return 0;

      const startISO = startDate.toISOString();
      // Limita o "fim" ao começo do dia de hoje — reuniões futuras não contam
      const todayStart = startOfDay(new Date());
      const effectiveEnd = endDate < todayStart ? endDate : todayStart;
      if (effectiveEnd <= startDate) return 0;
      const endISO = effectiveEnd.toISOString();

      let closerIdsForBU: Set<string> | null = null;
      if (buFilter) {
        const { data: closers } = await supabase
          .from("closers")
          .select("id")
          .eq("bu", buFilter);
        closerIdsForBU = new Set((closers || []).map((c) => c.id));
      }

      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer_id)
        `)
        .gte("meeting_slot.scheduled_at", startISO)
        .lt("meeting_slot.scheduled_at", endISO)
        .eq("meeting_slot.meeting_type", "r1");

      if (error) throw error;

      let attendees = (data || []).filter((a) => !a.is_partner);

      if (closerIdsForBU) {
        attendees = attendees.filter((a) => {
          const closerId = (a.meeting_slot as any)?.closer_id;
          return closerId && closerIdsForBU!.has(closerId);
        });
      }

      const semStatus = attendees.filter((a) =>
        ["scheduled", "invited", "rescheduled"].includes(a.status || "")
      );

      return semStatus.length;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30 * 1000,
  });
}