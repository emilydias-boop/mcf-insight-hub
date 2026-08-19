import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CloserFromBu {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Closers ATIVOS de uma BU. Usado para reconhecer como "agendador válido"
 * quem é closer e agenda R1 diretamente (precedente em useR1CloserMetrics:
 * "closers também podem agendar reuniões diretamente").
 */
export function useClosersFromBu(bu: string, enabled = true) {
  return useQuery({
    queryKey: ['closers-from-bu', bu],
    queryFn: async (): Promise<CloserFromBu[]> => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name, email')
        .eq('bu', bu)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as CloserFromBu[];
    },
    enabled: enabled && !!bu,
    staleTime: 60000,
  });
}