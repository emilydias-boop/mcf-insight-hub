import type { SdrCompPlan } from '@/types/sdr-fechamento';

/**
 * Percentual de Reuniões Realizadas sobre Agendadas usado como meta.
 * Default = 0.7 (70%). Se o comp plan tiver meta_reunioes_realizadas e meta_reunioes_agendadas
 * gravadas, deriva o percentual deles (ex.: maio/2026 incorporador = 0.6).
 */
export function getRealizadasPct(compPlan?: Partial<SdrCompPlan> | null): number {
  const metaR = Number(compPlan?.meta_reunioes_realizadas ?? 0);
  const metaA = Number(compPlan?.meta_reunioes_agendadas ?? 0);
  if (metaR > 0 && metaA > 0) {
    const ratio = metaR / metaA;
    if (ratio > 0 && ratio <= 1) return ratio;
  }
  return 0.7;
}

/**
 * Teto da taxa de No-Show (em %). Default = 30. Se o comp plan tiver
 * meta_no_show_pct definido (>0), usa esse valor.
 */
export function getNoShowMaxPct(compPlan?: Partial<SdrCompPlan> | null): number {
  const pct = Number(compPlan?.meta_no_show_pct ?? 0);
  if (pct > 0) return pct;
  return 30;
}