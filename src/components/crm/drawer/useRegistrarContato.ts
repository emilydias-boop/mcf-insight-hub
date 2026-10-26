import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProximaTipo, ResultadoContato } from './registrarContato';

export interface RegistrarContatoInput {
  dealId: string;
  resultado: ResultadoContato | null;
  nota: string | null;
  proximaTipo: ProximaTipo | null;
  proximaEm: string | null;
}

export interface RegistrarContatoRetorno {
  ok?: boolean;
  resultado?: string | null;
  proxima_acao_em?: string | null;
  retorno_concluido?: boolean;
}

const PREFIXOS = ['crm-deal', 'crm-deals', 'deal-header-info', 'lead-full-timeline', 'kanban', 'all-deal-notes', 'pending-next-actions', 'deal-activities'];

/** Chama a RPC registrar_contato (banco faz atividade, próxima ação e conclusão de retorno vencido). */
export function useRegistrarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: RegistrarContatoInput): Promise<RegistrarContatoRetorno> => {
      const args: { p_deal_id: string; p_resultado?: string; p_nota?: string; p_proxima_tipo?: string; p_proxima_em?: string } = { p_deal_id: i.dealId };
      if (i.resultado) args.p_resultado = i.resultado;
      if (i.nota) args.p_nota = i.nota;
      if (i.proximaEm) { args.p_proxima_em = i.proximaEm; args.p_proxima_tipo = i.proximaTipo || 'ligar'; }
      const { data, error } = await supabase.rpc('registrar_contato', args);
      if (error) throw error;
      return (data ?? {}) as RegistrarContatoRetorno;
    },
    onSuccess: () => { PREFIXOS.forEach(k => qc.invalidateQueries({ queryKey: [k] })); },
  });
}
