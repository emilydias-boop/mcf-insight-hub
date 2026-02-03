import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusinessUnit = 'incorporador' | 'consorcio' | 'credito' | 'projetos' | 'leilao';

export const BU_OPTIONS: { value: BusinessUnit | ""; label: string }[] = [
  { value: "", label: "Nenhuma" },
  { value: "incorporador", label: "BU - Incorporador MCF" },
  { value: "consorcio", label: "BU - Consórcio" },
  { value: "credito", label: "BU - Crédito" },
  { value: "projetos", label: "BU - Projetos" },
  { value: "leilao", label: "BU - Leilão" },
];

export function useMyBU() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bu", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("squad")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      // Retorna array de BUs ou array vazio
      return (data?.squad as BusinessUnit[]) || [];
    },
    enabled: !!user?.id,
  });
}

/**
 * Helper para verificar se usuário tem acesso a uma BU específica
 */
export function useHasBUAccess(bu: BusinessUnit): boolean {
  const { data: myBUs = [] } = useMyBU();
  return myBUs.includes(bu);
}
