import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLOSER_LIST_ACTIVE } from "@/constants/team";

export interface CloserMetricsRow {
  closerName: string;
  r1Realizadas: number;
  r2Agendadas: number;
  r2Realizadas: number;
  contratosPagos: number;
  vendasRealizadas: number;
  noShows: number;
  taxaConversao: number;
  taxaR2: number;
}

interface UseCloserMetricsParams {
  startDate: Date;
  endDate: Date;
}

export function useCloserMetrics({ startDate, endDate }: UseCloserMetricsParams) {
  return useQuery({
    queryKey: ["closer-metrics", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Fetch deal_activities for the period
      const { data: activities, error } = await supabase
        .from("deal_activities")
        .select("to_stage, metadata, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .in("to_stage", [
          "Reunião 01 Realizada",
          "Reunião 02 Agendada", 
          "Reunião 02 Realizada",
          "Contrato Pago",
          "Venda realizada",
          "No-Show",
        ]);

      if (error) throw error;

      // Initialize counters for each closer
      const closerMetrics: Record<string, {
        r1Realizadas: number;
        r2Agendadas: number;
        r2Realizadas: number;
        contratosPagos: number;
        vendasRealizadas: number;
        noShows: number;
      }> = {};

      CLOSER_LIST_ACTIVE.forEach(closer => {
        closerMetrics[closer.nome] = {
          r1Realizadas: 0,
          r2Agendadas: 0,
          r2Realizadas: 0,
          contratosPagos: 0,
          vendasRealizadas: 0,
          noShows: 0,
        };
      });

      // Process activities
      activities?.forEach(activity => {
        const metadata = activity.metadata as Record<string, any> | null;
        const dealUserName = (metadata?.deal_user_name || "").toLowerCase();

        // Find matching closer
        const matchedCloser = CLOSER_LIST_ACTIVE.find(closer =>
          closer.variations.some(v => dealUserName.includes(v.toLowerCase()))
        );

        if (!matchedCloser) return;

        const metrics = closerMetrics[matchedCloser.nome];
        
        switch (activity.to_stage) {
          case "Reunião 01 Realizada":
            metrics.r1Realizadas++;
            break;
          case "Reunião 02 Agendada":
            metrics.r2Agendadas++;
            break;
          case "Reunião 02 Realizada":
            metrics.r2Realizadas++;
            break;
          case "Contrato Pago":
            metrics.contratosPagos++;
            break;
          case "Venda realizada":
            metrics.vendasRealizadas++;
            break;
          case "No-Show":
            metrics.noShows++;
            break;
        }
      });

      // Calculate rates and build result
      const result: CloserMetricsRow[] = CLOSER_LIST_ACTIVE.map(closer => {
        const metrics = closerMetrics[closer.nome];
        const taxaConversao = metrics.r1Realizadas > 0 
          ? (metrics.contratosPagos / metrics.r1Realizadas) * 100 
          : 0;
        const taxaR2 = metrics.r2Agendadas > 0
          ? (metrics.r2Realizadas / metrics.r2Agendadas) * 100
          : 0;

        return {
          closerName: closer.nome,
          ...metrics,
          taxaConversao,
          taxaR2,
        };
      });

      // Calculate totals
      const totals = {
        r1Realizadas: result.reduce((sum, r) => sum + r.r1Realizadas, 0),
        r2Agendadas: result.reduce((sum, r) => sum + r.r2Agendadas, 0),
        r2Realizadas: result.reduce((sum, r) => sum + r.r2Realizadas, 0),
        contratosPagos: result.reduce((sum, r) => sum + r.contratosPagos, 0),
        vendasRealizadas: result.reduce((sum, r) => sum + r.vendasRealizadas, 0),
        noShows: result.reduce((sum, r) => sum + r.noShows, 0),
      };

      const taxaConversaoTotal = totals.r1Realizadas > 0
        ? (totals.contratosPagos / totals.r1Realizadas) * 100
        : 0;
      const taxaR2Total = totals.r2Agendadas > 0
        ? (totals.r2Realizadas / totals.r2Agendadas) * 100
        : 0;

      return {
        byCloser: result,
        totals: {
          ...totals,
          taxaConversao: taxaConversaoTotal,
          taxaR2: taxaR2Total,
        },
      };
    },
  });
}
