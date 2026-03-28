import { addDays } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';

/**
 * Calcula as fronteiras efetivas da semana do carrinho.
 * 
 * A semana vai de sábado 00:00 até sexta 23:59:59 (próximo sábado 00:00).
 * O horario_corte define apenas o horário da reunião, NÃO a fronteira da semana.
 * 
 * Exemplo: semana 08/03 (sáb) - 14/03 (sex)
 * - effectiveStart = 08/03 00:00
 * - effectiveEnd = 15/03 00:00 (próximo sábado)
 */
export function getCarrinhoWeekBoundaries(
  weekStart: Date,
  weekEnd: Date,
  _config?: CarrinhoConfig
): { effectiveStart: Date; effectiveEnd: Date } {
  // effectiveStart = weekStart (sábado) à 00:00
  const effectiveStart = new Date(weekStart);
  effectiveStart.setHours(0, 0, 0, 0);

  // effectiveEnd = próximo sábado à 00:00 (weekEnd + 1 dia)
  const effectiveEnd = addDays(new Date(weekEnd), 1);
  effectiveEnd.setHours(0, 0, 0, 0);

  return { effectiveStart, effectiveEnd };
}
