import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Pendencia = { etapa_id: string; doc_tipo: 'requisicao' | 'desligamento'; doc_id: string; papel: string; prazo: string | null; ordem: number; versao: number; hash: string; titulo: string | null; enviado_em: string };

export function useMinhasAprovacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gov-minhas-aprovacoes', user?.id], enabled: !!user?.id, staleTime: 60_000, refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gov_minhas_aprovacoes' as never);
      if (error) throw error;
      return (data ?? []) as unknown as Pendencia[];
    },
  });
}
