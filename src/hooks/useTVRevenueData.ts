import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WEEK_STARTS_ON } from "@/lib/businessDays";

interface RevenueData {
  atual: number;
  meta: number;
  percentual: number;
}

interface TVRevenueData {
  semanal: RevenueData;
  mensal: RevenueData;
  isLoading: boolean;
}

// Helper para formatar data no fuso horário de Brasília (UTC-3)
const formatDateForBrazil = (date: Date, isEndOfDay: boolean = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (isEndOfDay) {
    return `${year}-${month}-${day}T23:59:59-03:00`;
  }
  return `${year}-${month}-${day}T00:00:00-03:00`;
};

export function useTVRevenueData(viewDate: Date = new Date()): TVRevenueData {
  const weekStart = startOfWeek(viewDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(viewDate, { weekStartsOn: WEEK_STARTS_ON });
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);

  const { data, isLoading } = useQuery({
    queryKey: ["tv-revenue-data", format(viewDate, "yyyy-MM-dd")],
    queryFn: async () => {
      // Buscar meta semanal do team_targets
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const { data: weeklyTarget } = await supabase
        .from("team_targets")
        .select("target_value")
        .eq("target_type", "team_revenue")
        .eq("week_start", weekStartStr)
        .maybeSingle();

      const metaSemanal = weeklyTarget?.target_value || 500000; // Default 500k
      const metaMensal = metaSemanal * 4.33; // Aproximação mensal

      // Buscar faturamento semanal
      const weekStartBr = formatDateForBrazil(weekStart, false);
      const weekEndBr = formatDateForBrazil(weekEnd, true);

      const { data: weeklyRevenue } = await supabase
        .from("hubla_transactions")
        .select("net_value, product_category, source")
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,source.eq.kiwify,source.eq.make,source.eq.hubla_make_sync")
        .gt("net_value", 0)
        .or("count_in_dashboard.is.null,count_in_dashboard.eq.true")
        .gte("sale_date", weekStartBr)
        .lte("sale_date", weekEndBr);

      // Buscar faturamento mensal
      const monthStartBr = formatDateForBrazil(monthStart, false);
      const monthEndBr = formatDateForBrazil(monthEnd, true);

      const { data: monthlyRevenue } = await supabase
        .from("hubla_transactions")
        .select("net_value, product_category, source")
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,source.eq.kiwify,source.eq.make,source.eq.hubla_make_sync")
        .gt("net_value", 0)
        .or("count_in_dashboard.is.null,count_in_dashboard.eq.true")
        .gte("sale_date", monthStartBr)
        .lte("sale_date", monthEndBr);

      // Calcular totais (excluindo categorias que não contam)
      const excludedCategories = ["clube_arremate", "efeito_alavanca", "imersao"];
      
      const filterRevenue = (transactions: typeof weeklyRevenue) => {
        return (transactions || [])
          .filter(tx => !excludedCategories.includes(tx.product_category || ""))
          .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      };

      const faturamentoSemanal = filterRevenue(weeklyRevenue);
      const faturamentoMensal = filterRevenue(monthlyRevenue);

      return {
        semanal: {
          atual: faturamentoSemanal,
          meta: metaSemanal,
          percentual: metaSemanal > 0 ? (faturamentoSemanal / metaSemanal) * 100 : 0,
        },
        mensal: {
          atual: faturamentoMensal,
          meta: metaMensal,
          percentual: metaMensal > 0 ? (faturamentoMensal / metaMensal) * 100 : 0,
        },
      };
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    staleTime: 0,
  });

  return {
    semanal: data?.semanal || { atual: 0, meta: 0, percentual: 0 },
    mensal: data?.mensal || { atual: 0, meta: 0, percentual: 0 },
    isLoading,
  };
}
