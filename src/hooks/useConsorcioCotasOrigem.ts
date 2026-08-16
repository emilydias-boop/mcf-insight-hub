import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cotas que nasceram DENTRO do funil: existe um `consorcio_pending_registrations`
 * apontando para o card (`consortium_card_id`). As demais são "externas" —
 * criadas direto pelo botão "+ Adicionar Cota", sem passar por reunião/proposta.
 */
export function useConsorcioCotasOrigem() {
  return useQuery({
    queryKey: ['consorcio-cotas-origem-funil'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('consortium_card_id')
        .not('consortium_card_id', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.consortium_card_id) set.add(r.consortium_card_id as string);
      });
      return set;
    },
  });
}
