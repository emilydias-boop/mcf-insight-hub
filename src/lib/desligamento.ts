export const TIPOS_DESLIGAMENTO = { sem_justa_causa: 'Sem justa causa', justa_causa: 'Justa causa', acordo: 'Acordo', experiencia: 'Término de contrato de experiência', pj: 'Encerramento de contrato PJ', pedido_demissao: 'Pedido de demissão' };
export type TipoDesligamento = keyof typeof TIPOS_DESLIGAMENTO;
export type Remocao = { chave: string; justificativa: string; validada_por?: string | null; validada_em?: string | null };
export function validarEnvioDesligamento(d: { motivo: string; descricao: string; data_prevista: string | null; justificativa: string; justificativa_reforcada: string; sem_evidencia_recente: boolean; remocoes: Remocao[] }) {
  if (!d.motivo.trim() || !d.descricao.trim() || !d.data_prevista || !d.justificativa.trim()) return 'Preencha motivo, descrição, data prevista e justificativa';
  if (d.sem_evidencia_recente && !d.justificativa_reforcada.trim()) return 'Inclua a justificativa reforçada';
  if (d.remocoes.some(r => !r.validada_por)) return 'Aguarde a validação do RH para as remoções';
  return null;
}
export function podeRemoverSignatario(s: { obrigatorio?: boolean; chave: string }) { return !s.obrigatorio && s.chave !== 'rh'; }