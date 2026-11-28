export interface ParcelaGrade {
  id: string;
  card_id: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: number;
  tipo: string;
  status: string;
  data_pagamento: string | null;
  valor_estimado: boolean | null;
  pagamento_fonte: string | null;
  pagamento_confirmado_por: string | null;
  pagamento_confirmado_nome?: string | null;
  pagamento_confirmado_em: string | null;
  conferido_embracon_em: string | null;
  conferido_embracon_ref: string | null;
}

export function situacaoParcelaGrade(parcela: ParcelaGrade | undefined, hoje: string) {
  if (!parcela) return 'nao_gerada';
  if (parcela.status === 'pago' || parcela.data_pagamento) return 'paga';
  if (parcela.status === 'previsto') return 'prevista';
  return parcela.data_vencimento < hoje ? 'vencida' : 'a_vencer';
}

export function inicioBlocoParcelas(numero: number, prazo: number) {
  const ultimo = Math.max(1, prazo);
  return Math.floor((Math.max(1, Math.min(numero, ultimo)) - 1) / 12) * 12 + 1;
}

export function numerosBlocoParcelas(inicio: number, prazo: number) {
  return Array.from({ length: Math.max(0, Math.min(12, prazo - inicio + 1)) }, (_, i) => inicio + i);
}

export function marcaConfirmacao(parcela: ParcelaGrade) {
  if (parcela.conferido_embracon_em) return 'embracon';
  return parcela.pagamento_fonte === 'manual' ? 'manual' : null;
}

export function dadosConfirmacaoManual(dataPagamento: string, usuarioId: string, confirmadoEm: string) {
  if (!dataPagamento || !usuarioId) throw new Error('Data real e usuário são obrigatórios');
  return {
    status: 'pago',
    data_pagamento: dataPagamento,
    pagamento_fonte: 'manual',
    pagamento_confirmado_por: usuarioId,
    pagamento_confirmado_em: confirmadoEm,
  };
}