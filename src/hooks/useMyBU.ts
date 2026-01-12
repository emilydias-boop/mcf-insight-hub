import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusinessUnit = 'incorporador' | 'consorcio' | 'credito' | 'projetos';

export const BU_OPTIONS: { value: BusinessUnit | ""; label: string }[] = [
  { value: "", label: "Nenhuma" },
  { value: "incorporador", label: "BU - Incorporador MCF" },
  { value: "consorcio", label: "BU - Consórcio" },
  { value: "credito", label: "BU - Crédito" },
  { value: "projetos", label: "BU - Projetos" },
];

export function useMyBU() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bu", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("squad")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data?.squad as BusinessUnit | null;
    },
    enabled: !!user?.id,
  });
}
