import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface CloserBreakdownRow {
  closer_id: string;
  closer_name: string;
  closer_bu: string | null;
  r1_recebida: number;
  r1_realizada: number;
  no_shows: number;
  contratos: number;
}

export interface CloserBreakdownResponse {
  effective_end_date: string;
  today_sp: string;
  closers: CloserBreakdownRow[];
}

/**
 * Métricas por closer (R1 recebida / realizada / no-shows / contratos)
 * usadas para calcular a média do closer no breakdown das taxas
 * (Conversão e No-Show) na página de Reuniões da Equipe.
 *
 * Mesmas regras de fato consumado do RPC do SDR:
 * - R1 recebida usa janela completa (planejamento)
 * - R1 realizada / no-shows / contratos: cap em hoje
 * - No-show com cap 1 antes de 2026-04-28, cap 2 depois
 */
export function useCloserBreakdownMetrics(
  startDate: Date | null,
  endDate: Date | null,
  buFilter?: string | null,
) {
  return useQuery({
    queryKey: [
      "closer-breakdown-metrics",
      startDate?.toISOString(),
      endDate?.toISOString(),
      buFilter ?? null,
    ],
    queryFn: async (): Promise<CloserBreakdownResponse> => {
      if (!startDate || !endDate) {
        return {
          effective_end_date: "",
          today_sp: "",
          closers: [],
        };
      }
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      const { data, error } = await supabase.rpc(
        "get_closer_breakdown_metrics" as any,
        {
          start_date: startStr,
          end_date: endStr,
          bu_filter: buFilter ?? null,
        },
      );
      if (error) {
        console.error("[useCloserBreakdownMetrics]", error);
        throw error;
      }
      return (data as CloserBreakdownResponse) || {
        effective_end_date: "",
        today_sp: "",
        closers: [],
      };
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Helper: calcula a média simples de uma taxa entre closers com volume > 0.
 */
export function averageRate(
  rows: { numerator: number; denominator: number }[],
): number {
  const valid = rows.filter((r) => r.denominator > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, r) => acc + (r.numerator / r.denominator) * 100, 0);
  return sum / valid.length;
}