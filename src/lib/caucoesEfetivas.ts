import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resposta de caucoes_efetivas compartilhada entre os blocos da tela que pedem
 * o mesmo período/BU (antes eram 5 chamadas idênticas em Reuniões de Equipe).
 * Usa a chave 'caucoes-efetivas', já invalidada pelas telas de atribuição.
 * As linhas são compartilhadas: quem usa NÃO pode alterá-las.
 */
export async function fetchCaucoesEfetivas(
  queryClient: QueryClient,
  from: string,
  to: string,
  bu: string,
): Promise<any[]> {
  // Espera o fim do tick: quando várias chaves são invalidadas em sequência,
  // garante que 'caucoes-efetivas' também já foi invalidada antes da leitura.
  await Promise.resolve();
  return queryClient.fetchQuery({
    queryKey: ['caucoes-efetivas', from, to, bu],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await (supabase as any).rpc('caucoes_efetivas', {
        p_from: from,
        p_to: to,
        p_bu: bu,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    staleTime: 15_000,
  });
}
