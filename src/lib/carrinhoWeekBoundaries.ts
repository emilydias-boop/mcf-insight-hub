import { subDays } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';

/**
 * Calcula as fronteiras efetivas da semana do carrinho baseado no horário de corte.
 * 
 * Exemplo: semana 07/03 (sáb) - 13/03 (sex), corte 12:00
 * - effectiveStart = 06/03 12:00 (sexta anterior ao horário de corte)
 * - effectiveEnd = 13/03 12:00 (sexta atual ao horário de corte)
 * 
 * Isso garante que contratos vendidos após o último carrinho da semana anterior
 * sejam contabilizados na semana seguinte.
 */
export function getCarrinhoWeekBoundaries(
  weekStart: Date,
  weekEnd: Date,
  config?: CarrinhoConfig
): { effectiveStart: Date; effectiveEnd: Date } {
  const horarioCorte = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const [hours, minutes] = horarioCorte.split(':').map(Number);

  // effectiveStart = day before weekStart (Friday) at horario_corte
  const effectiveStart = subDays(new Date(weekStart), 1);
  effectiveStart.setHours(hours, minutes || 0, 0, 0);

  // effectiveEnd = weekEnd (Friday) at horario_corte
  const effectiveEnd = new Date(weekEnd);
  effectiveEnd.setHours(hours, minutes || 0, 0, 0);

  return { effectiveStart, effectiveEnd };
}
