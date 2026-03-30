import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';

/**
 * Calcula as fronteiras efetivas da semana do carrinho (legacy — Sáb 00:00 → próx Sáb 00:00).
 * Mantida para compatibilidade; novos usos devem preferir getCarrinhoMetricBoundaries.
 */
export function getCarrinhoWeekBoundaries(
  weekStart: Date,
  weekEnd: Date,
  _config?: CarrinhoConfig
): { effectiveStart: Date; effectiveEnd: Date } {
  const effectiveStart = new Date(weekStart);
  effectiveStart.setHours(0, 0, 0, 0);

  const effectiveEnd = addDays(new Date(weekEnd), 1);
  effectiveEnd.setHours(0, 0, 0, 0);

  return { effectiveStart, effectiveEnd };
}

/**
 * Retorna o início da semana do carrinho (Quinta-feira) para uma data qualquer.
 */
export function getCartWeekStart(date: Date): Date {
  const d = startOfDay(new Date(date));
  const day = d.getDay(); // 0=Dom ... 4=Qui ... 6=Sáb
  // Voltar até a última quinta
  const diff = (day + 7 - 4) % 7; // dias desde quinta
  return startOfDay(subDays(d, diff));
}

/**
 * Retorna o fim da semana do carrinho (Quarta-feira) para uma data qualquer.
 */
export function getCartWeekEnd(date: Date): Date {
  const start = getCartWeekStart(date);
  return startOfDay(addDays(start, 6)); // Qui + 6 = Qua
}

export interface CarrinhoMetricBoundaries {
  /** Contratos pagos: Qui 00:00 → Qua 23:59:59.999 */
  contratos: { start: Date; end: Date };
  /** R2 meetings: Sex 00:00 (pós-carrinho anterior) → Sex 23:59 (dia do carrinho atual) */
  r2Meetings: { start: Date; end: Date };
  /** Aprovados: Sex pós-carrinho anterior 00:00 → Sex do carrinho atual HH:mm (corte) */
  aprovados: { start: Date; end: Date };
  /** Vendas parceria: Sex do carrinho HH:mm (corte) → Seg 23:59 */
  vendasParceria: { start: Date; end: Date };
  /** R1 realizadas: mesma janela dos contratos */
  r1Meetings: { start: Date; end: Date };
}

/**
 * Calcula janelas de data específicas por tipo de métrica do carrinho.
 *
 * Ciclo do carrinho (exemplo: carrinho sexta 28/03):
 * - Contratos:       Qui 20/03 00:00 → Qua 26/03 23:59
 * - R2 Agendadas:    Sex 21/03 00:00 → Sex 28/03 23:59
 * - Vendas Parceria: Sex 28/03 00:00 → Seg 31/03 23:59
 * - R1 Realizadas:   Qui 20/03 00:00 → Qua 26/03 23:59
 *
 * @param weekStart Quinta-feira início da semana (Thu-Wed)
 * @param weekEnd   Quarta-feira fim da semana (Thu-Wed)
 */
export function getCarrinhoMetricBoundaries(
  weekStart: Date,
  weekEnd: Date,
  _config?: CarrinhoConfig
): CarrinhoMetricBoundaries {
  // weekStart = Quinta, weekEnd = Quarta
  const thuStart = startOfDay(new Date(weekStart));
  const wedEnd = endOfDay(new Date(weekEnd));

  // Sexta após o carrinho anterior = dia seguinte ao thuStart (Qui+1 = Sex)
  const friAfterPrevCart = startOfDay(addDays(thuStart, 1));
  // Sexta do carrinho atual = wedEnd + 2 dias (Qua+2 = Sex)
  const friCurrentCart = endOfDay(addDays(new Date(weekEnd), 2));

  // Vendas parceria: Sex do carrinho → Seg (Sex+3)
  const friCartStart = startOfDay(addDays(new Date(weekEnd), 2));
  const monAfterCart = endOfDay(addDays(friCartStart, 3));

  return {
    contratos: { start: thuStart, end: wedEnd },
    r2Meetings: { start: friAfterPrevCart, end: friCurrentCart },
    vendasParceria: { start: friCartStart, end: monAfterCart },
    r1Meetings: { start: thuStart, end: wedEnd },
  };
}
