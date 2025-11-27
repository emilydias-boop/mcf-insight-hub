/**
 * CONVENÇÃO DE SEMANA CUSTOMIZADA
 * ================================
 * Neste sistema, as semanas começam no SÁBADO e terminam na SEXTA-FEIRA.
 * Esta convenção é diferente do padrão ISO 8601 (segunda a domingo).
 * 
 * Todas as funções de manipulação de semana devem usar estas funções helpers
 * para garantir consistência em todo o sistema.
 */

import { addDays, subDays, format, differenceInWeeks, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Retorna o sábado (início) da semana customizada para uma data específica
 * @param date - Data de referência
 * @returns Data do sábado da semana
 */
export function getCustomWeekStart(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  
  if (dayOfWeek === 6) {
    // Já é sábado
    return startOfDay(date);
  } else {
    // Voltar para o sábado mais recente
    const daysToSubtract = dayOfWeek === 0 ? 1 : dayOfWeek + 1;
    return startOfDay(subDays(date, daysToSubtract));
  }
}

/**
 * Retorna a sexta-feira (fim) da semana customizada para uma data específica
 * @param date - Data de referência
 * @returns Data da sexta-feira da semana
 */
export function getCustomWeekEnd(date: Date): Date {
  const weekStart = getCustomWeekStart(date);
  return startOfDay(addDays(weekStart, 6)); // Sábado + 6 dias = Sexta
}

/**
 * Adiciona ou subtrai semanas customizadas (sáb-sex) de uma data
 * @param date - Data de referência
 * @param weeks - Número de semanas (positivo = futuro, negativo = passado)
 * @returns Nova data após adicionar/subtrair semanas
 */
export function addCustomWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Formata o range de uma semana customizada (sáb-sex)
 * @param date - Data de referência
 * @returns String formatada "DD/MM - DD/MM/YYYY"
 */
export function formatCustomWeekRange(date: Date): string {
  const start = getCustomWeekStart(date);
  const end = getCustomWeekEnd(date);
  
  const startDay = format(start, "dd/MM", { locale: ptBR });
  const endFormatted = format(end, "dd/MM/yyyy", { locale: ptBR });
  
  return `${startDay} - ${endFormatted}`;
}

/**
 * Formata o range de uma semana customizada em formato CURTO
 * @param date - Data de referência
 * @returns String formatada "DD/MM/YY"
 */
export function formatCustomWeekRangeShort(date: Date): string {
  const start = getCustomWeekStart(date);
  return format(start, "dd/MM/yy", { locale: ptBR });
}

/**
 * Verifica se uma data está na semana customizada atual
 * @param date - Data para verificar
 * @returns true se a data está na semana atual
 */
export function isInCurrentCustomWeek(date: Date): boolean {
  const today = new Date();
  const currentWeekStart = getCustomWeekStart(today);
  const currentWeekEnd = getCustomWeekEnd(today);
  
  return date >= currentWeekStart && date <= currentWeekEnd;
}

/**
 * Retorna o número da semana customizada no formato "YYYY-WXX"
 * @param date - Data de referência
 * @returns String no formato "2025-W05"
 */
export function getCustomWeekNumber(date: Date): string {
  const year = date.getFullYear();
  const firstSaturdayOfYear = getCustomWeekStart(new Date(year, 0, 1));
  const weekStart = getCustomWeekStart(date);
  
  const weekNumber = differenceInWeeks(weekStart, firstSaturdayOfYear) + 1;
  
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Gera um array de semanas customizadas entre duas datas
 * @param startDate - Data inicial
 * @param endDate - Data final
 * @returns Array de objetos com informações de cada semana
 */
export function getCustomWeeksInRange(startDate: Date, endDate: Date): Array<{
  weekNumber: string;
  weekLabel: string;
  startDate: Date;
  endDate: Date;
}> {
  const weeks: Array<{
    weekNumber: string;
    weekLabel: string;
    startDate: Date;
    endDate: Date;
  }> = [];
  
  let currentWeekStart = getCustomWeekStart(startDate);
  const finalWeekStart = getCustomWeekStart(endDate);
  
  while (currentWeekStart <= finalWeekStart) {
    const currentWeekEnd = getCustomWeekEnd(currentWeekStart);
    
    weeks.push({
      weekNumber: getCustomWeekNumber(currentWeekStart),
      weekLabel: formatCustomWeekRange(currentWeekStart),
      startDate: currentWeekStart,
      endDate: currentWeekEnd,
    });
    
    currentWeekStart = addCustomWeeks(currentWeekStart, 1);
  }
  
  return weeks;
}

/**
 * Verifica se uma data é sexta-feira (último dia da semana customizada)
 * @param date - Data para verificar
 * @returns true se for sexta-feira
 */
export function isCustomWeekEnd(date: Date): boolean {
  return date.getDay() === 5; // 5 = Sexta-feira
}

/**
 * Verifica se uma data é sábado (primeiro dia da semana customizada)
 * @param date - Data para verificar
 * @returns true se for sábado
 */
export function isCustomWeekStart(date: Date): boolean {
  return date.getDay() === 6; // 6 = Sábado
}

/**
 * Formata uma data para string YYYY-MM-DD sem conversão de timezone
 * @param date - Data para formatar
 * @returns String no formato "YYYY-MM-DD"
 */
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
