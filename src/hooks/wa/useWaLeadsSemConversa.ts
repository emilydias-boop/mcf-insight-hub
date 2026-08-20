import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Negócio da carteira do usuário que ainda não tem conversa de WhatsApp aberta. */
export interface WaLeadSemConversa {
  deal_id: string;
  contato: string;
  telefone: string;
  phone_e164: string;
  estagio: string;
  produto: string | null;
  criado_em: string;
  atividades: number;
}

/**
 * Lista leads da carteira do operador que ainda não têm conversa no WhatsApp.
 * A RPC `wa_leads_sem_conversa` já filtra telefone inválido, opt-out,
 * arquivados e duplicados.
 */
export function useWaLeadsSemConversa(busca: string, enabled: boolean) {
  return useQuery({
    queryKey: ['wa-leads-sem-conversa', busca],
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wa_leads_sem_conversa', {
        _busca: busca.trim() || null,
        _limite: 50,
      });
      if (error) throw error;
      return (data ?? []) as WaLeadSemConversa[];
    },
  });
}

/**
 * Abre (ou recupera) uma conversa de WhatsApp a partir de um deal da carteira.
 * Devolve o uuid da conversa criada/recuperada.
 */
export function useAbrirConversa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.rpc('wa_abrir_conversa', {
        _deal_id: dealId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      qc.invalidateQueries({ queryKey: ['wa-leads-sem-conversa'] });
    },
    onError: (err: unknown) => {
      // A mensagem vem pronta em português da RPC — mostrar exatamente como vem.
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir conversa');
    },
  });
}
