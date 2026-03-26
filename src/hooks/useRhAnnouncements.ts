import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RhAnnouncement {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: 'aviso' | 'aniversariante' | 'recado_gestao' | 'evento';
  destaque: boolean;
  data_publicacao: string;
  data_expiracao: string | null;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
}

export const ANNOUNCEMENT_TYPE_LABELS: Record<RhAnnouncement['tipo'], { label: string; icon: string; color: string }> = {
  aviso: { label: 'Aviso', icon: '📌', color: 'bg-yellow-500' },
  aniversariante: { label: 'Aniversariante', icon: '🎂', color: 'bg-pink-500' },
  recado_gestao: { label: 'Recado da Gestão', icon: '📢', color: 'bg-blue-500' },
  evento: { label: 'Evento', icon: '🎉', color: 'bg-purple-500' },
};

export function useActiveAnnouncements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["rh-announcements-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_announcements" as any)
        .select("*")
        .eq("ativo", true)
        .order("destaque", { ascending: false })
        .order("data_publicacao", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as RhAnnouncement[];
    },
    enabled: !!user,
  });
}
