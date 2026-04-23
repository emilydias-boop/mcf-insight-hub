import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface SdrForSquadInPeriod {
  sdr_id: string;
  email: string;
  name: string;
  current_squad: string | null;
  was_in_squad_during_period: boolean;
  is_currently_in_squad: boolean;
}

/**
 * Returns all SDRs that belonged to a given squad at any point during the period.
 * Uses the sdr_squad_history table so SDRs that have since moved to another squad
 * (e.g. Leticia moved from incorporador to credito) still appear for past periods.
 */
export function useSdrsForSquadInPeriod(
  squad: string,
  startDate: Date | null,
  endDate: Date | null
) {
  return useQuery({
    queryKey: [
      "sdrs-for-squad-in-period",
      squad,
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
    ],
    queryFn: async (): Promise<SdrForSquadInPeriod[]> => {
      if (!startDate || !endDate) return [];

      const { data, error } = await supabase.rpc(
        "get_sdrs_for_squad_in_period",
        {
          p_squad: squad,
          p_start: startDate.toISOString(),
          p_end: endDate.toISOString(),
        }
      );

      if (error) {
        console.error("[useSdrsForSquadInPeriod] RPC error:", error);
        throw error;
      }

      return (data as SdrForSquadInPeriod[]) || [];
    },
    enabled: !!startDate && !!endDate && !!squad,
    staleTime: 60000,
  });
}