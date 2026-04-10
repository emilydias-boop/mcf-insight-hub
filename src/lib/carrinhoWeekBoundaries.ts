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
  /** R2 meetings: Sex anterior no corte → Sex atual no corte */
  r2Meetings: { start: Date; end: Date };
  /** Aprovados: Sex anterior no corte → Sex atual no corte */
  aprovados: { start: Date; end: Date };
  /** Vendas parceria: Sex do carrinho 00:00 → Seg 23:59 */
  vendasParceria: { start: Date; end: Date };
  /** R1 realizadas: mesma janela dos contratos */
  r1Meetings: { start: Date; end: Date };
}

/**
 * Calcula janelas de data específicas por tipo de métrica do carrinho.
 *
 * Ciclo do carrinho (exemplo: safra Qui 03/04 - Qua 09/04, carrinho sexta 10/04):
 * - Contratos:       Qui 03/04 00:00 → Qua 09/04 23:59
 * - R2 Agendadas:    Sex 03/04 12:00 (corte anterior) → Sex 10/04 12:00 (corte atual)
 * - Aprovados:       Sex 03/04 12:00 (corte anterior) → Sex 10/04 12:00 (corte atual)
 * - Vendas Parceria: Sex 10/04 00:00 → Seg 13/04 23:59
 * - R1 Realizadas:   Qui 03/04 00:00 → Qua 09/04 23:59
 *
 * @param weekStart Quinta-feira início da semana (Thu-Wed)
 * @param weekEnd   Quarta-feira fim da semana (Thu-Wed)
 */
export function getCarrinhoMetricBoundaries(
  weekStart: Date,
  weekEnd: Date,
  config?: CarrinhoConfig,
  previousConfig?: CarrinhoConfig
): CarrinhoMetricBoundaries {
  // Helper: meia-noite local para uma data
  const localStartOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };
  // Helper: 23:59:59.999 local para uma data
  const localEndOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(23, 59, 59, 999);
    return r;
  };

  // weekStart = Quinta, weekEnd = Quarta
  const thuStart = localStartOfDay(new Date(weekStart));
  const wedEnd = localEndOfDay(new Date(weekEnd));

  // Sexta do carrinho atual = Qui + 1 dia (sexta da mesma semana)
  const currentFriday = addDays(new Date(weekStart), 1);
  // Sexta anterior = uma semana antes
  const previousFriday = subDays(currentFriday, 7);

  // Horário de corte da sexta anterior (usa previousConfig, fallback config, fallback 12:00)
  const prevHorarioCorte = previousConfig?.carrinhos?.[0]?.horario_corte
    || config?.carrinhos?.[0]?.horario_corte
    || '12:00';
  const [prevCutHour, prevCutMinute] = prevHorarioCorte.split(':').map(Number);
  const previousFridayCutoff = new Date(
    previousFriday.getFullYear(), previousFriday.getMonth(), previousFriday.getDate(),
    prevCutHour, prevCutMinute || 0, 0, 0
  );

  // Horário de corte da sexta atual (default 12:00)
  const horarioCorte = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const [cutHour, cutMinute] = horarioCorte.split(':').map(Number);
  const currentFridayCutoff = new Date(
    currentFriday.getFullYear(), currentFriday.getMonth(), currentFriday.getDate(),
    cutHour, cutMinute || 0, 0, 0
  );

  // Vendas parceria: Sex do carrinho atual 00:00 → Seg 23:59:59
  const friCartStart = localStartOfDay(currentFriday);
  const monAfterCart = localEndOfDay(addDays(currentFriday, 3));

  return {
    contratos: { start: thuStart, end: wedEnd },
    r2Meetings: { start: previousFridayCutoff, end: currentFridayCutoff },
    aprovados: { start: previousFridayCutoff, end: currentFridayCutoff },
    vendasParceria: { start: friCartStart, end: monAfterCart },
    r1Meetings: { start: thuStart, end: wedEnd },
  };
}
