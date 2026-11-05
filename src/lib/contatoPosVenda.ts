export interface ResumoContato {
  lastTouchAt?: string | null;
  lastContactAttempt?: string | null;
  totalActivities?: number;
  posVendaContatoConfirmado?: boolean | null;
}

/** Pós-Venda exige as duas evidências; uma ligação isolada não substitui a confirmação. */
export function estadoContato(resumo: ResumoContato | null | undefined, posVenda: boolean) {
  if (!resumo) return { ultimoToque: null, nuncaContatado: false };
  if (posVenda) {
    const confirmado = resumo.posVendaContatoConfirmado === true;
    return { ultimoToque: confirmado ? resumo.lastTouchAt ?? null : null, nuncaContatado: !confirmado };
  }
  const ultimoToque = resumo.lastTouchAt ?? resumo.lastContactAttempt ?? null;
  return { ultimoToque, nuncaContatado: !ultimoToque && (resumo.totalActivities || 0) === 0 };
}