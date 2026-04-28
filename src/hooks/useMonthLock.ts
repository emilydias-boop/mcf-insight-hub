import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface MonthLock {
  id: string;
  ano_mes: string;
  locked_at: string;
  locked_by: string | null;
  locked_reason: string | null;
  unlocked_at: string | null;
  unlocked_by: string | null;
  unlocked_reason: string | null;
  is_active: boolean;
}

/** Returns the lock record (active or not) for a given YYYY-MM. */
export function useMonthLock(anoMes: string | null) {
  return useQuery({
    queryKey: ["month-lock", anoMes],
    enabled: !!anoMes,
    queryFn: async (): Promise<MonthLock | null> => {
      if (!anoMes) return null;
      const { data, error } = await supabase
        .from("meeting_status_locks")
        .select("*")
        .eq("ano_mes", anoMes)
        .maybeSingle();
      if (error) throw error;
      return (data as MonthLock) || null;
    },
    staleTime: 60_000,
  });
}

/** Convenience: derives YYYY-MM from a Date. */
export function toAnoMes(d: Date | null | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM");
}

/** Lists all active locks (for admin overview). */
export function useAllMonthLocks() {
  return useQuery({
    queryKey: ["month-locks-all"],
    queryFn: async (): Promise<MonthLock[]> => {
      const { data, error } = await supabase
        .from("meeting_status_locks")
        .select("*")
        .order("ano_mes", { ascending: false });
      if (error) throw error;
      return (data || []) as MonthLock[];
    },
    staleTime: 30_000,
  });
}