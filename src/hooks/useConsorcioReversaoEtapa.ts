import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * "Voltar etapa" no funil Consórcio.
 *
 * REGRAS QUE VALEM AQUI (decisão do dono, 24/08/2026):
 *  - NUNCA há DELETE. A cota fica viva, marcada como revertida (`revertida_em`)
 *    e sai do funil — para reconciliação com o Dash e com a Embracon.
 *  - NENHUM evento sai e nenhum é cancelado. `revertida_*`, `tipo_registro`,
 *    `data_contratacao` e `data_reserva` NÃO estão na lista observada pelo
 *    trigger `trg_enqueue_outbound_consorcio_webhook` (status, valor_credito,
 *    valor_comissao, parcelas_pagas_empresa, contemplação, valor_lance,
 *    tipo_produto, grupo, cota). `webhook_carta_cadastrada_enviado_em` é
 *    preservado: zero reenvio.
 *  - Nenhum evento financeiro: nada de título, cobrança, comissão, MCF Pay,
 *    Asaas ou adm.mcfcapital.com.br.
 *  - Motivo obrigatório, mínimo 15 caracteres — validado no cliente E no banco.
 *  - Papel: só quem opera a tela Venda Consórcio pode voltar etapa. A trava real
 *    está DENTRO das RPCs (`can_reverter_etapa_consorcio`), não no botão —
 *    viewer/marketing puros recebem recusa mesmo chamando a API direto. As
 *    escritas passam por RPC SECURITY DEFINER porque a policy de UPDATE de
 *    `consorcio_pending_registrations` é só admin/manager/coordenador.
 *  - As RPCs também validam a ETAPA DE ORIGEM: nunca escrevem no id que vier.
 *  - Nenhuma data é inventada: sem `data_reserva` gravada, o desfazer é recusado
 *    com instrução, em vez de ancorar uma data que ninguém registrou.

 */

export const MOTIVO_MIN = 15;

export interface ReversaoStatus {
  registro_id: string;
  card_id: string | null;
  card_existe: boolean;
  parcela_paga: boolean;
  contemplacao: boolean;
  transferencia: boolean;
  mes_fechado: boolean;
  mes_referencia: string | null;
  /** true só quando o evento `consorcio.venda.criada` está `sent`. */
  dash_anunciado: boolean;
}

/** Motivo escrito do bloqueio, ou null quando a reversão está liberada. */
export function motivoBloqueio(s?: ReversaoStatus | null): string | null {
  if (!s) return null;
  if (s.parcela_paga) return 'Não dá para voltar: existe parcela paga nesta cota.';
  if (s.contemplacao) return 'Não dá para voltar: a cota tem contemplação registrada.';
  if (s.transferencia) return 'Não dá para voltar: a cota está em processo de transferência.';
  if (s.mes_fechado) return `Não dá para voltar: o mês de comissão ${s.mes_referencia || ''} já está fechado.`;
  return null;
}

export function useReversaoStatus(registroIds: string[]) {
  const ids = [...new Set(registroIds)].sort();
  return useQuery({
    queryKey: ['consorcio-reversao-status', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, ReversaoStatus>> => {
      const { data, error } = await supabase.rpc('consorcio_reversao_status', { p_registro_ids: ids });
      if (error) throw error;
      const mapa: Record<string, ReversaoStatus> = {};
      for (const r of (data || []) as ReversaoStatus[]) mapa[r.registro_id] = r;
      return mapa;
    },
  });
}

const invalidarFunil = (qc: ReturnType<typeof useQueryClient>) => {
  for (const key of [
    'consorcio-cotas-cadastradas',
    'consortium-cards',
    'consorcio-cotas-reservadas',
    'consorcio-reservas-aguardando',
    'consorcio-pending-registrations',
    'consorcio-reversao-status',
    'consorcio-funil-r1',
  ]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
};

/** Etapa 5 → 4: devolve o cadastro para "Cotas a Fazer". */
export function useReverterEtapa5Para4() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registroId, motivo }: { registroId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('consorcio_reverter_etapa_5_para_4', {
        p_registro_id: registroId,
        p_motivo: motivo,
      });
      if (error) throw error;
      return data as { ok: boolean; card_marcado_revertido: boolean; dash_anunciado: boolean };
    },
    onSuccess: (res) => {
      invalidarFunil(qc);
      toast.success('Voltou para Cotas a Fazer', {
        description: res?.dash_anunciado
          ? 'A cota foi marcada como revertida. Ela já havia sido anunciada ao Dash — reconcilie manualmente.'
          : 'A cota não foi apagada: ficou marcada como revertida, com motivo e rastro.',
      });
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível voltar a etapa.'),
  });
}

/** Etapa 6 → 5: desfaz "parcela inicial paga" e devolve a cota para reserva. */
export function useDesfazerParcelaInicial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registroId, motivo }: { registroId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('consorcio_desfazer_parcela_inicial', {
        p_registro_id: registroId,
        p_motivo: motivo,
      });
      if (error) throw error;
      return data as { ok: boolean; cota_devolvida_reserva: boolean };
    },
    onSuccess: (res) => {
      invalidarFunil(qc);
      toast.success('Marcação desfeita', {
        description: res?.cota_devolvida_reserva
          ? 'A cota voltou para reserva e saiu da etapa Cotas.'
          : 'O marcador foi limpo. A cota não existe mais no sistema, então não havia o que devolver para reserva.',
      });
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível desfazer.'),
  });
}
