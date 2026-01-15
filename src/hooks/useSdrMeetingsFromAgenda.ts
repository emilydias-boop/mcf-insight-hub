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
}

interface UseSdrMeetingsFromAgendaParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string;
}

export function useSdrMeetingsFromAgenda({
  startDate,
  endDate,
  sdrEmailFilter,
}: UseSdrMeetingsFromAgendaParams) {
  return useQuery({
    queryKey: [
      "sdr-meetings-from-agenda",
      startDate?.toISOString(),
      endDate?.toISOString(),
      sdrEmailFilter,
    ],
    queryFn: async (): Promise<MeetingV2[]> => {
      if (!startDate || !endDate) return [];

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase.rpc("get_sdr_meetings_from_agenda", {
        start_date: startStr,
        end_date: endStr,
        sdr_email_filter: sdrEmailFilter || null,
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
          status_atual: row.status_atual || "Reunião 01 Agendada",
          intermediador: row.intermediador || "",
          current_owner: row.intermediador || "",
          closer: row.closer || null,
          origin_name: row.origin_name || "",
          probability: row.probability || 0,
          conta: true,
          total_movimentacoes: 1,
          from_stage: null,
        };
      });
    },
    enabled: !!startDate && !!endDate,
  });
}
