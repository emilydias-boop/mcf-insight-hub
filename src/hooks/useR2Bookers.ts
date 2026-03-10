import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface R2Booker {
  id: string;
  nome: string;
  isR1Closer: boolean;
}

export function useR2Bookers() {
  return useQuery({
    queryKey: ["r2-bookers"],
    queryFn: async (): Promise<R2Booker[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("can_book_r2", true)
        .order("full_name");

      if (error) throw error;

      // Fetch R1 closer emails
      const { data: r1Closers } = await supabase
        .from("closers")
        .select("email")
        .or("meeting_type.eq.r1,meeting_type.is.null")
        .eq("is_active", true);

      const r1Emails = new Set(
        (r1Closers || []).map((c) => c.email?.toLowerCase())
      );

      return (data || []).map((p) => ({
        id: p.id,
        nome: p.full_name || "Sem nome",
        isR1Closer: r1Emails.has(p.email?.toLowerCase()),
      }));
    },
  });
}
