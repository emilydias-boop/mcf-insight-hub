import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface R2Booker {
  id: string;
  nome: string;
}

export function useR2Bookers() {
  return useQuery({
    queryKey: ["r2-bookers"],
    queryFn: async (): Promise<R2Booker[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("can_book_r2", true)
        .order("full_name");

      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        nome: p.full_name || "Sem nome",
      }));
    },
  });
}
