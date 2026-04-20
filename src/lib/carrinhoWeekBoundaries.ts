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
  /** R2 meetings: Qui 00:00 da safra → Sex DA safra no corte */
  r2Meetings: { start: Date; end: Date };
  /** Aprovados: Qui 00:00 da safra → Sex DA safra no corte */
  aprovados: { start: Date; end: Date };
  /** Vendas parceria: Sex do carrinho 00:00 → Seg 23:59 */
  vendasParceria: { start: Date; end: Date };
  /** R1 realizadas: mesma janela dos contratos */
  r1Meetings: { start: Date; end: Date };
  /** Sexta-feira da semana ANTERIOR no horário de corte (abertura real da janela operacional desta safra) */
  previousCutoff: Date;
  /** Alias semântico para previousCutoff (sexta de fechamento da safra anterior = abertura da atual) */
  safraOpeningCutoff: Date;
  /** Janela operacional do carrinho: Sex anterior 12:00 → Sex desta semana 12:00 (filtro para R2 agendadas/realizadas/fora) */
  carrinhoOperacional: { start: Date; end: Date };
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

  // Sexta da safra atual = Qui + 1 dia (sexta da mesma semana — fechamento desta safra)
  const currentFriday = addDays(new Date(weekStart), 1);
  // Sexta da safra ANTERIOR = Qui - 6 dias (sexta da semana anterior — abertura desta safra)
  const previousFriday = subDays(new Date(weekStart), 6);
  // Sexta da SEMANA SEGUINTE = Qui + 8 dias (corte do carrinho desta safra)
  const nextFriday = addDays(new Date(weekStart), 8);

  // Horário de corte da sexta atual (default 12:00)
  const horarioCorte = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const [cutHour, cutMinute] = horarioCorte.split(':').map(Number);
  const currentFridayCutoff = new Date(
    currentFriday.getFullYear(), currentFriday.getMonth(), currentFriday.getDate(),
    cutHour, cutMinute || 0, 0, 0
  );
  // Corte da sexta seguinte (mesmo horario_corte)
  const nextFridayCutoff = new Date(
    nextFriday.getFullYear(), nextFriday.getMonth(), nextFriday.getDate(),
    cutHour, cutMinute || 0, 0, 0
  );

  // Horário de corte da sexta ANTERIOR (usa previousConfig se disponível)
  const prevHorarioCorte = previousConfig?.carrinhos?.[0]?.horario_corte || horarioCorte;
  const [prevCutHour, prevCutMinute] = prevHorarioCorte.split(':').map(Number);
  const previousFridayCutoff = new Date(
    previousFriday.getFullYear(), previousFriday.getMonth(), previousFriday.getDate(),
    prevCutHour, prevCutMinute || 0, 0, 0
  );

  // R2 Meetings e Aprovados: janela do CARRINHO = Qui da safra 00:00 → Sex da SEMANA SEGUINTE no corte.
  // O R2 pode acontecer ao longo da semana toda da safra E até a sexta seguinte no horário de corte.
  // Vendas parceria: Sex desta semana no corte → Seg 23:59 (captura boletos atrasados após o fechamento do carrinho).
  const nextMonday = addDays(nextFriday, 3); // Sex+1 + 3 = Seg da semana seguinte
  const nextMondayEnd = localEndOfDay(nextMonday);

  return {
    contratos: { start: thuStart, end: wedEnd },
    r2Meetings: { start: thuStart, end: nextFridayCutoff },
    aprovados: { start: thuStart, end: nextFridayCutoff },
    vendasParceria: { start: nextFridayCutoff, end: nextMondayEnd },
    r1Meetings: { start: thuStart, end: wedEnd },
    previousCutoff: previousFridayCutoff,
    safraOpeningCutoff: previousFridayCutoff,
    carrinhoOperacional: { start: currentFridayCutoff, end: nextFridayCutoff },
  };
}

/**
 * Retorna a data de referência da safra "operacionalmente ativa" para o carrinho.
 *
 * Lógica:
 * - Qui 00:00 → Sex antes do corte (12:00): safra atual = a que termina nessa quarta (em construção)
 * - Sex pós-corte → próxima Qua 23:59: safra ativa = a que acabou de fechar (Qui anterior - Qua dessa semana)
 *
 * Isso evita que o usuário precise clicar "voltar" na sexta após o corte para ver a safra
 * que ainda está sendo finalizada operacionalmente (vendas pós-aprovação rolam até a próxima sexta).
 *
 * @param now Data/hora atual (default: new Date())
 * @param cutoffHour Hora do corte (default: 12)
 * @param cutoffMinute Minuto do corte (default: 0)
 */
export function getActiveCartReferenceDate(
  now: Date = new Date(),
  cutoffHour: number = 12,
  cutoffMinute: number = 0
): Date {
  const day = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isPastCutoff = hour > cutoffHour || (hour === cutoffHour && minute >= cutoffMinute);

  // Sex pós-corte (5) | Sáb (6) | Dom (0) | Seg (1) | Ter (2) | Qua (3)
  // → mostrar safra que acabou de fechar (a quinta anterior)
  // Qui (4) | Sex pré-corte → mostrar safra em construção (a quinta atual ou recém-passada)

  if (day === 5 && !isPastCutoff) {
    // Sex pré-corte: safra em construção (começa Qui ontem) — usar hoje
    return now;
  }
  if (day === 5 && isPastCutoff) {
    // Sex pós-corte: já passou o corte, mostrar safra que acabou de fechar (Qua = -2)
    return subDays(now, 2);
  }
  if (day === 6 || day === 0 || day === 1 || day === 2 || day === 3) {
    // Sáb/Dom/Seg/Ter/Qua: continua na safra que acabou de fechar (Qua passada)
    // day=6→-3, day=0→-4, day=1→-5, day=2→-6, day=3→-7
    const daysBack = day === 6 ? 3 : day === 0 ? 4 : day + 4;
    return subDays(now, daysBack);
  }
  // Qui (4): nova safra começa hoje — usar hoje
  return now;
}
