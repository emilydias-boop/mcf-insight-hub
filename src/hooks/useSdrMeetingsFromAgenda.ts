import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MeetingV2 } from "./useSdrMetricsV2";

interface AgendaMeetingRow {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  tipo: string;
  data_agendamento: string;
  scheduled_at: string;
  status_atual: string;
  intermediador: string;
  closer: string;
  origin_name: string;
  probability: number;
  attendee_id: string | null;
  meeting_slot_id: string | null;
  attendee_status: string | null;
  sdr_email: string | null;
  booked_at: string | null;
  ordem_no_show: number | null;
  total_no_shows_deal: number | null;
  conta_no_show: boolean | null;
}

interface UseSdrMeetingsFromAgendaParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string;
  buFilter?: string;
  /** Quando true, retorna também as reuniões canceladas (msa.status='cancelled').
   *  Usado especialmente pelo card "Pendentes / Sem Desfecho" para fechar a
   *  conta com R1 Agendada. Padrão: false. */
  includeCancelled?: boolean;
  /** Quando true, usa o RPC alinhado ao KPI Agendamentos (mesma janela e
   *  dedup do painel "Reuniões da Equipe"). Padrão: false (comportamento legado). */
  alignedWithKpi?: boolean;
}

export function useSdrMeetingsFromAgenda({
  startDate,
  endDate,
  sdrEmailFilter,
  buFilter,
  includeCancelled = false,
  alignedWithKpi = false,
}: UseSdrMeetingsFromAgendaParams) {
  return useQuery({
    queryKey: [
      "sdr-meetings-from-agenda",
      startDate?.toISOString(),
      endDate?.toISOString(),
      sdrEmailFilter,
      buFilter,
      includeCancelled,
      alignedWithKpi,
    ],
    queryFn: async (): Promise<MeetingV2[]> => {
      if (!startDate || !endDate) return [];

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const rpcName = alignedWithKpi
        ? "get_sdr_meetings_from_agenda_aligned"
        : "get_sdr_meetings_from_agenda";

      const { data, error } = await supabase.rpc(rpcName as any, {
        start_date: startStr,
        end_date: endStr,
        sdr_email_filter: sdrEmailFilter || null,
        bu_filter: buFilter || null,
        include_cancelled: includeCancelled,
      });

      if (error) {
        console.error("Error fetching meetings from agenda:", error);
        throw error;
      }

      // Map to MeetingV2 format
      return (data as AgendaMeetingRow[] || []).map((row): MeetingV2 => {
        // Map tipo to valid union type
        let tipoValue: "1º Agendamento" | "Reagendamento Válido" | "Reagendamento Inválido" = "1º Agendamento";
        if (row.tipo === "Reagendamento") {
          tipoValue = "Reagendamento Válido";
        }

        return {
          deal_id: row.deal_id,
          deal_name: row.deal_name || "",
          contact_name: row.contact_name || "",
          contact_email: row.contact_email || "",
          contact_phone: row.contact_phone || "",
          tipo: tipoValue,
          data_agendamento: row.data_agendamento,
          scheduled_at: row.scheduled_at || null,
          status_atual: row.status_atual || "Reunião 01 Agendada",
          intermediador: row.intermediador || "",
          current_owner: row.sdr_email || row.intermediador || "",
          closer: row.closer || null,
          origin_name: row.origin_name || "",
          probability: row.probability || 0,
          conta: true,
          total_movimentacoes: 1,
          from_stage: null,
          // New fields for attendee actions
          attendee_id: row.attendee_id || null,
          meeting_slot_id: row.meeting_slot_id || null,
          attendee_status: row.attendee_status || null,
          booked_at: row.booked_at || null,
          ordem_no_show: row.ordem_no_show ?? null,
          total_no_shows_deal: row.total_no_shows_deal ?? null,
          conta_no_show: row.conta_no_show ?? null,
        };
      });
    },
    enabled: !!startDate && !!endDate,
  });
}
