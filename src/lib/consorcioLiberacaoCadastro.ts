import type { ConsorcioTermo } from '@/hooks/useConsorcioTermos';

/**
 * Data do PRIMEIRO termo de adesão existente na base (`min(created_at)` de
 * `consorcio_termos` com `tipo = 'adesao'`). Antes disso o fluxo de termo não
 * existia, então nenhum cadastro anterior teve a chance de ter um: travar
 * retroativamente inventaria pendência que a equipe não pode resolver.
 */
export const DATA_PRIMEIRO_TERMO_ADESAO = '2026-08-19';

export interface RegistroLiberacao {
  id: string;
  proposal_id?: string | null;
  aceite_date?: string | null;
  created_at?: string | null;
  status?: string | null;
}

type MapaTermos = Record<string, ConsorcioTermo[]>;

/**
 * O termo é UM POR VENDA e grava só o `pending_registration_id` da 1ª carta —
 * por isso lemos pela proposta, com o vínculo por cadastro como fallback (mesma
 * regra do selo "Termo assinado" da linha).
 */
export function termosDoCadastro(
  reg: RegistroLiberacao,
  termosByProposal: MapaTermos,
  termosByPending: MapaTermos,
): ConsorcioTermo[] {
  return (reg.proposal_id ? termosByProposal[reg.proposal_id] : undefined) || termosByPending[reg.id] || [];
}

/**
 * Cadastro LIBERADO para a equipe abrir a cota na Embracon quando:
 *  - a venda tem termo de adesão assinado; ou
 *  - não tem `proposal_id` (cadastro avulso do "Adicionar Pendente", que nunca
 *    terá termo e não pode ficar preso); ou
 *  - foi criado antes de {@link DATA_PRIMEIRO_TERMO_ADESAO} (base histórica).
 */
export function cadastroLiberado(
  reg: RegistroLiberacao,
  termosByProposal: MapaTermos,
  termosByPending: MapaTermos,
): boolean {
  if (!reg.proposal_id) return true;
  const base = reg.aceite_date || (reg.created_at ? String(reg.created_at).slice(0, 10) : null);
  if (base && base < DATA_PRIMEIRO_TERMO_ADESAO) return true;
  return termosDoCadastro(reg, termosByProposal, termosByPending).some((t) => t.status === 'assinado');
}

/**
 * Cadastro TRAVADO: ainda aguarda abertura de cota e a venda não tem assinatura.
 * É o que sai da contagem do funil e vai para a lista recolhida da etapa 4.
 */
export function cadastroTravadoSemAssinatura(
  reg: RegistroLiberacao,
  termosByProposal: MapaTermos,
  termosByPending: MapaTermos,
): boolean {
  return reg.status === 'aguardando_abertura' && !cadastroLiberado(reg, termosByProposal, termosByPending);
}

/** Data-âncora do "dias parados" da lista travada: geração do termo, senão criação. */
export function ancoraEsperaAssinatura(
  reg: RegistroLiberacao,
  termosByProposal: MapaTermos,
  termosByPending: MapaTermos,
): string | null | undefined {
  const termos = termosDoCadastro(reg, termosByProposal, termosByPending);
  const gerado = termos
    .map((t) => t.created_at)
    .filter(Boolean)
    .sort()
    .pop();
  return gerado || reg.created_at;
}
