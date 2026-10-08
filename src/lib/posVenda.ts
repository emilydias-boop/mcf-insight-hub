import { getAnamneseV2 } from '@/components/crm/AnamneseExternaButton';

/** Pipeline única da BU Pós Venda ("Relacionamento - Pós venda"). */
export const POS_VENDA_ORIGIN_ID = 'b05a0000-0000-4000-8000-000000000002';

export const POS_VENDA_CONCLUIDA_STAGE_ID = 'b05a0001-0000-4000-8000-000000000003';

/** Etapa de entrada das vendas novas (A00x/R00x) via webhook. */
export const POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID = 'b05a0001-0000-4000-8000-000000000000';

export const isPosVendaDeal = (deal: unknown): boolean =>
  (deal as { origin_id?: string | null } | null)?.origin_id === POS_VENDA_ORIGIN_ID;

/** Anamnese ausente ou não preenchida → precisa verificar no HARVEY. */
export const precisaVerificarHarvey = (deal: unknown): boolean => {
  const a = getAnamneseV2(deal);
  if (!a) return true;
  if (a.preenchida === false) return true;
  return !a.pdf_url && !(a.estruturada?.secoes?.length);
};
