import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RhPolicy {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: 'politica' | 'codigo_conduta' | 'manual' | 'procedimento' | 'outro';
  arquivo_url: string | null;
  storage_path: string | null;
  versao: string | null;
  obrigatoria: boolean;
  ativa: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export const POLICY_CATEGORY_LABELS: Record<RhPolicy['categoria'], { label: string; icon: string }> = {
  politica: { label: 'Políticas', icon: '📄' },
  codigo_conduta: { label: 'Código de Conduta', icon: '📋' },
  manual: { label: 'Manuais', icon: '📘' },
  procedimento: { label: 'Procedimentos', icon: '📝' },
  outro: { label: 'Outros', icon: '📎' },
};

export function useActivePolicies() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["rh-policies-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_policies" as any)
        .select("*")
        .eq("ativa", true)
        .order("categoria")
        .order("titulo");

      if (error) throw error;
      return (data || []) as unknown as RhPolicy[];
    },
    enabled: !!user,
  });
}
