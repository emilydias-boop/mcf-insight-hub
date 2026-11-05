export type RequisicaoStatus = 'rascunho' | 'em_aprovacao' | 'aprovada' | 'reprovada' | 'devolvida' | 'em_recrutamento' | 'concluida' | 'cancelada';
export const STATUS_REQUISICAO: Record<RequisicaoStatus, string> = {
  rascunho: 'Rascunho', em_aprovacao: 'Em aprovação', aprovada: 'Aprovada', reprovada: 'Reprovada',
  devolvida: 'Devolvida para ajuste', em_recrutamento: 'Em recrutamento', concluida: 'Concluída', cancelada: 'Cancelada',
};
export function exigeJustificativa(tipo: string, salario: number, minimo: number | null, maximo: number | null, alcada: boolean) {
  return tipo === 'aumento_quadro' || (minimo !== null && salario < minimo) || (maximo !== null && salario > maximo) || alcada;
}
export function transicaoPermitida(de: RequisicaoStatus, para: RequisicaoStatus) {
  const fluxo: Record<RequisicaoStatus, RequisicaoStatus[]> = {
    rascunho: ['em_aprovacao', 'cancelada'], devolvida: ['em_aprovacao', 'cancelada'],
    em_aprovacao: ['cancelada'], aprovada: ['em_recrutamento', 'cancelada'],
    em_recrutamento: ['concluida', 'cancelada'], reprovada: [], concluida: [], cancelada: [],
  };
  return fluxo[de].includes(para);
}