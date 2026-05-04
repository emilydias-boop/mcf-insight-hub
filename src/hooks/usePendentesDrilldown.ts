import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { MeetingV2 } from "./useSdrMetricsV2";

export interface PendenteDrillRow extends MeetingV2 {
  pendente_reason: "sem_desfecho" | "no_show_acima_cap";
}

interface Params {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string;
  buFilter?: string;
  enabled?: boolean;
}

/**
 * Lista TODOS os leads contabilizados como "Pendentes / Sem Desfecho" no card
 * de Reuniões da Equipe — incluindo dias de no-show que ultrapassaram o cap
 * (1 antes de 01/05/2026, 2 depois). Usado pelo drill-down do KPI.
 */
export function usePendentesDrilldown({
  startDate,
  endDate,
  sdrEmailFilter,
  buFilter,
  enabled = true,
}: Params) {
  return useQuery({
    queryKey: [
      "pendentes-drilldown",
      startDate?.toISOString(),
      endDate?.toISOString(),
      sdrEmailFilter,
      buFilter,
    ],
    queryFn: async (): Promise<PendenteDrillRow[]> => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase.rpc(
        "get_sdr_pendentes_drilldown" as any,
        {
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          sdr_email_filter: sdrEmailFilter || null,
          bu_filter: buFilter || null,
        },
      );
      if (error) throw error;
      return ((data as any[]) || []).map((r): PendenteDrillRow => ({
        deal_id: r.out_deal_id,
        deal_name: r.out_deal_name || "",
        contact_name: r.out_contact_name || "",
        contact_email: r.out_contact_email || "",
        contact_phone: r.out_contact_phone || "",
        tipo: "1º Agendamento",
        data_agendamento: r.out_scheduled_at,
        scheduled_at: r.out_scheduled_at || null,
        status_atual: r.out_status_atual || "Reunião 01 Agendada",
        intermediador: r.out_intermediador || "",
        current_owner: r.out_sdr_email || r.out_intermediador || "",
        closer: r.out_closer || null,
        origin_name: r.out_origin_name || "",
        probability: 0,
        conta: true,
        total_movimentacoes: 1,
        from_stage: null,
        attendee_id: r.out_attendee_id || null,
        meeting_slot_id: r.out_meeting_slot_id || null,
        attendee_status: r.out_attendee_status || null,
        booked_at: null,
        ordem_no_show: null,
        total_no_shows_deal: null,
        conta_no_show: null,
        pendente_reason: r.out_pendente_reason,
      }));
    },
    enabled: enabled && !!startDate && !!endDate,
  });
}