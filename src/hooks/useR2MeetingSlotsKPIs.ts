import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, addHours } from "date-fns";

export interface R2MeetingSlotsKPIs {
  r2Agendadas: number;    // R2 meetings scheduled (not cancelled)
  r2Realizadas: number;   // R2 meetings completed
}

async function filterDealIdsBySegment(dealIds: string[], seg: string): Promise<Set<string>> {
  const allowed = new Set<string>();
  const ids = Array.from(new Set(dealIds.filter(Boolean)));
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await (supabase.from('crm_deals') as any)
      .select('id, icp_segment')
      .in('id', chunk);
    if (error) throw error;
    (data || []).forEach((row: any) => {
      const v = (row.icp_segment ?? '').toString().trim().toUpperCase();
      if (v === seg) allowed.add(row.id);
    });
  }
  return allowed;
}

export function useR2MeetingSlotsKPIs(startDate: Date, endDate: Date, segment?: string) {
  const seg = segment && segment !== 'all' ? segment.toUpperCase() : null;
  return useQuery({
    queryKey: ["r2-meeting-slots-kpis", startDate.toISOString(), endDate.toISOString(), seg],
    queryFn: async (): Promise<R2MeetingSlotsKPIs> => {
      // Corrigir fuso horário BRT (UTC-3): somar 3h para alinhar com useR1CloserMetrics
      const BRT_OFFSET_HOURS = 3;
      const startISO = addHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();
      const endISO = addHours(endOfDay(endDate), BRT_OFFSET_HOURS).toISOString();

      // Query meeting_slot_attendees for R2 meetings (meeting_type = 'r2')
      // This counts each attendee correctly (slots can have multiple attendees)
      const { data, error } = await supabase
        .from("meeting_slot_attendees")
        .select(`
          status,
          is_partner,
          deal_id,
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
      let attendees = (data || []).filter((a) => !a.is_partner);

      // Filtro opcional por segmento ICP (via deal_id → crm_deals.icp_segment)
      if (seg) {
        const allowed = await filterDealIdsBySegment(
          attendees.map((a: any) => a.deal_id).filter(Boolean),
          seg,
        );
        attendees = attendees.filter((a: any) => a.deal_id && allowed.has(a.deal_id));
      }

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
