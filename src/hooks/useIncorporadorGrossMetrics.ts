import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { getDeduplicatedGross, TransactionForGross } from "@/lib/incorporadorPricing";

// Week starts on Saturday (6) - matches useSetoresDashboard
const WEEK_STARTS_ON = 6;

// Ajusta data para fuso horário de São Paulo (UTC-3)
const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

interface IncorporadorGrossMetrics {
  brutoSemanal: number;
  brutoMensal: number;
  brutoAnual: number;
  isLoading: boolean;
  error: Error | null;
}

export function useIncorporadorGrossMetrics(): IncorporadorGrossMetrics {
  const today = new Date();
  
  // Calculate period boundaries
  const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);

  const { data, isLoading, error } = useQuery({
    queryKey: ['incorporador-gross-metrics', weekStart.toISOString(), monthStart.toISOString(), yearStart.toISOString()],
    queryFn: async () => {
      // Fetch transactions for each period using the RPC
      // The RPC already filters by source, status, excludes products, and calculates gross_winner
      const [weeklyData, monthlyData, annualData] = await Promise.all([
        supabase.rpc('get_all_hubla_transactions', {
          p_search: null,
          p_start_date: formatDateForQuery(weekStart),
          p_end_date: formatDateForQuery(weekEnd, true),
          p_limit: 5000,
        }),
        supabase.rpc('get_all_hubla_transactions', {
          p_search: null,
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 5000,
        }),
        supabase.rpc('get_all_hubla_transactions', {
          p_search: null,
          p_start_date: formatDateForQuery(yearStart),
          p_end_date: formatDateForQuery(yearEnd, true),
          p_limit: 10000,
        }),
      ]);

      if (weeklyData.error) throw weeklyData.error;
      if (monthlyData.error) throw monthlyData.error;
      if (annualData.error) throw annualData.error;

      // Calculate gross totals using the shared deduplication logic
      const calculateGross = (transactions: TransactionForGross[] | null): number => {
        if (!transactions) return 0;
        return transactions.reduce((sum, t) => sum + getDeduplicatedGross(t), 0);
      };

      return {
        brutoSemanal: calculateGross(weeklyData.data),
        brutoMensal: calculateGross(monthlyData.data),
        brutoAnual: calculateGross(annualData.data),
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // 30 seconds - matches useSetoresDashboard
  });

  return {
    brutoSemanal: data?.brutoSemanal ?? 0,
    brutoMensal: data?.brutoMensal ?? 0,
    brutoAnual: data?.brutoAnual ?? 0,
    isLoading,
    error: error as Error | null,
  };
}
