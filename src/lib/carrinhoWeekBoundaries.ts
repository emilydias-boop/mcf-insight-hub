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
  /** R2 meetings: janela operacional entre cortes */
  r2Meetings: { start: Date; end: Date };
  /** Aprovados: Qui 00:00 da safra → Sex DA safra no corte */
  aprovados: { start: Date; end: Date };
  /** Vendas parceria: Sex do carrinho 00:00 → Seg 23:59 */
  vendasParceria: { start: Date; end: Date };
  /** R1 realizadas: mesma janela dos contratos */
  r1Meetings: { start: Date; end: Date };
  /** Corte da semana ANTERIOR no horário configurado (abertura real da janela operacional desta safra) */
  previousCutoff: Date;
  /** Alias semântico para previousCutoff (fechamento da safra anterior = abertura da atual) */
  safraOpeningCutoff: Date;
  /** Janela operacional do carrinho: corte anterior → corte atual (filtro para R2 agendadas/realizadas/fora) */
  carrinhoOperacional: { start: Date; end: Date };
}

/**
 * Calcula janelas de data específicas por tipo de métrica do carrinho.
 *
 * Nova regra (a partir de 06/05/2026): a SAFRA do Carrinho é uma janela fixa
 * de 7 dias corridos Quinta 00:00 → Quarta 23:59. Não há mais corte intra-dia
 * (sexta 12:00) para fechar/abrir safra. A janela `vendasParceria` mantém
 * a regra própria (Sex 00:00 → Seg 23:59 da semana seguinte).
 *
 * Ciclo do carrinho (exemplo: safra Qui 03/04 - Qua 09/04):
 * - Contratos:        Qui 03/04 00:00 → Qua 09/04 23:59
 * - R2 Agendadas:     Qui 03/04 00:00 → Qua 09/04 23:59
 * - Aprovados:        Qui 03/04 00:00 → Qua 09/04 23:59
 * - Vendas Parceria:  Sex 04/04 00:00 → Seg 14/04 23:59 (corte de sexta usado APENAS aqui)
 * - R1 Realizadas:    Qui 03/04 00:00 → Qua 09/04 23:59
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

  // Dia de corte: usa `dia_corte` explícito se presente; senão deriva do último dia em `dias` (legado).
  // O corte pertence ao carrinho APÓS a safra (primeiro dia configurado a partir do dia seguinte ao weekEnd),
  // não à quinta de abertura da safra.
  const firstCart = config?.carrinhos?.[0];
  const dias = firstCart?.dias ?? [5];
  const explicitCutDay = typeof firstCart?.dia_corte === 'number' ? firstCart.dia_corte : null;
  const lastDay = explicitCutDay !== null
    ? explicitCutDay
    : (dias.length > 0 ? Math.max(...dias) : 5);
  const currentCutoffBase = localStartOfDay(addDays(new Date(weekEnd), 1));
  const cutoffOffset = (lastDay - currentCutoffBase.getDay() + 7) % 7;

  const currentCutoffDay = addDays(currentCutoffBase, cutoffOffset);
  // Dia de corte da SEMANA ANTERIOR (pode ser diferente do atual).
  // weekStart anterior = weekStart - 7. Usamos `dia_corte` do previousConfig se presente,
  // senão derivamos do último dia em `dias` (legado), senão fallback = mesmo dia do atual.
  const prevFirstCart = previousConfig?.carrinhos?.[0];
  const prevDias = prevFirstCart?.dias;
  const prevExplicitCutDay = typeof prevFirstCart?.dia_corte === 'number' ? prevFirstCart.dia_corte : null;
  const prevLastDay = prevExplicitCutDay !== null
    ? prevExplicitCutDay
    : (prevDias && prevDias.length > 0 ? Math.max(...prevDias) : lastDay);
  const previousWeekEnd = subDays(new Date(weekEnd), 7);
  const previousCutoffBase = localStartOfDay(addDays(previousWeekEnd, 1));
  const prevCutoffOffset = (prevLastDay - previousCutoffBase.getDay() + 7) % 7;
  const previousCutoffDay = addDays(previousCutoffBase, prevCutoffOffset);

  // Horário do corte atual (dia + hora configurados)
  const horarioCorte = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const [cutHour, cutMinute] = horarioCorte.split(':').map(Number);
  const currentCutoff = new Date(
    currentCutoffDay.getFullYear(), currentCutoffDay.getMonth(), currentCutoffDay.getDate(),
    cutHour, cutMinute || 0, 0, 0
  );
  // Horário de corte ANTERIOR (usa previousConfig se disponível, mesma posição de dia da semana atual)
  const prevHorarioCorte = previousConfig?.carrinhos?.[0]?.horario_corte || horarioCorte;
  const [prevCutHour, prevCutMinute] = prevHorarioCorte.split(':').map(Number);
  const previousCutoff = new Date(
    previousCutoffDay.getFullYear(), previousCutoffDay.getMonth(), previousCutoffDay.getDate(),
    prevCutHour, prevCutMinute || 0, 0, 0
  );

  // NOVA REGRA: R2 Meetings, Aprovados e operacional do Carrinho usam a janela
  // FIXA Qui 00:00 → Qua 23:59 (mesma janela de Contratos).
  // O `previousCutoff` agora representa Qui 00:00 desta safra — usado para
  // classificar "Semanas Anteriores" (lead com R2 nesta safra mas contrato pago
  // em semana calendário anterior).
  // Vendas parceria continua usando o corte de sexta: corte desta semana → Seg 23:59 da semana seguinte.
  const nextMonday = addDays(weekEnd, 5);
  const nextMondayEnd = localEndOfDay(nextMonday);
  const safraStart = thuStart; // Qui 00:00 desta safra

  return {
    contratos: { start: thuStart, end: wedEnd },
    r2Meetings: { start: thuStart, end: wedEnd },
    aprovados: { start: thuStart, end: wedEnd },
    vendasParceria: { start: currentCutoff, end: nextMondayEnd },
    r1Meetings: { start: thuStart, end: wedEnd },
    previousCutoff: safraStart,
    safraOpeningCutoff: safraStart,
    carrinhoOperacional: { start: thuStart, end: wedEnd },
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
