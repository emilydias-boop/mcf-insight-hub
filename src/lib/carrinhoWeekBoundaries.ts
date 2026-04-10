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
  config?: CarrinhoConfig
): CarrinhoMetricBoundaries {
  // Helper: meia-noite UTC para uma data (evita fuso local do startOfDay)
  const utcStartOfDay = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  // Helper: 23:59:59.999 UTC para uma data (evita fuso local do endOfDay)
  const utcEndOfDay = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));

  // weekStart = Quinta, weekEnd = Quarta
  const thuStart = utcStartOfDay(new Date(weekStart));
  const wedEnd = utcEndOfDay(new Date(weekEnd));

  // Sexta após o carrinho anterior = dia seguinte ao thuStart (Qui+1 = Sex)
  const friAfterPrevCart = utcStartOfDay(addDays(new Date(weekStart), 1));
  // Sexta do carrinho atual = wedEnd + 2 dias (Qua+2 = Sex)
  const friCurrentCart = utcEndOfDay(addDays(new Date(weekEnd), 2));

  // Horário de corte da sexta (default 12:00)
  const horarioCorte = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const [cutHour, cutMinute] = horarioCorte.split(':').map(Number);

  // Sexta do carrinho atual com corte de horário (UTC)
  const friCartCutoffDate = addDays(new Date(weekEnd), 2);
  const friCartCutoff = new Date(Date.UTC(
    friCartCutoffDate.getFullYear(), friCartCutoffDate.getMonth(), friCartCutoffDate.getDate(),
    cutHour, cutMinute || 0, 0, 0
  ));

  // Vendas parceria: Sex do carrinho 00:00 UTC → Seg 23:59:59 UTC
  const friDate = addDays(new Date(weekEnd), 2);
  const friCartStart = utcStartOfDay(friDate);
  const monAfterCart = utcEndOfDay(addDays(friDate, 3));

  return {
    contratos: { start: thuStart, end: wedEnd },
    r2Meetings: { start: friAfterPrevCart, end: friCartCutoff },
    aprovados: { start: friAfterPrevCart, end: friCartCutoff },
    vendasParceria: { start: friCartStart, end: monAfterCart },
    r1Meetings: { start: thuStart, end: wedEnd },
  };
}
