import { addDays, getDay, format, parse, isWeekend, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

// Feriados nacionais fixos (MM-DD)
const FERIADOS_FIXOS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // N.S. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

// Função para calcular Páscoa (algoritmo de Meeus/Jones/Butcher)
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Retorna feriados móveis para um ano específico
function getFeriadosMoveis(ano: number): string[] {
  const pascoa = calcularPascoa(ano);
  const feriadosMoveis: string[] = [];
  
  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = addDays(pascoa, -2);
  feriadosMoveis.push(format(sextaSanta, 'MM-dd'));
  
  // Carnaval (47 dias antes da Páscoa - terça-feira)
  const carnaval = addDays(pascoa, -47);
  feriadosMoveis.push(format(carnaval, 'MM-dd'));
  
  // Segunda de Carnaval
  const segundaCarnaval = addDays(pascoa, -48);
  feriadosMoveis.push(format(segundaCarnaval, 'MM-dd'));
  
  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = addDays(pascoa, 60);
  feriadosMoveis.push(format(corpusChristi, 'MM-dd'));
  
  return feriadosMoveis;
}

// Verifica se uma data é feriado
export function isFeriado(data: Date): boolean {
  const ano = data.getFullYear();
  const dataFormatada = format(data, 'MM-dd');
  
  // Verifica feriados fixos
  if (FERIADOS_FIXOS.includes(dataFormatada)) {
    return true;
  }
  
  // Verifica feriados móveis
  const feriadosMoveis = getFeriadosMoveis(ano);
  return feriadosMoveis.includes(dataFormatada);
}

// Verifica se é dia útil
export function isDiaUtil(data: Date): boolean {
  return !isWeekend(data) && !isFeriado(data);
}

// Calcula o próximo dia útil a partir de uma data
export function calcularProximoDiaUtil(data: Date): Date {
  let resultado = new Date(data);
  
  while (!isDiaUtil(resultado)) {
    resultado = addDays(resultado, 1);
  }
  
  return resultado;
}

// Calcula a data de vencimento considerando o dia do mês e ajustando para dia útil
export function calcularDataVencimento(
  dataBase: Date,
  diaVencimento: number,
  numeroParcela: number
): Date {
  // Calcula o mês da parcela
  const mesBase = dataBase.getMonth();
  const anoBase = dataBase.getFullYear();
  
  let mesParcela = mesBase + numeroParcela;
  let anoParcela = anoBase;
  
  while (mesParcela > 11) {
    mesParcela -= 12;
    anoParcela += 1;
  }
  
  // Ajusta o dia se o mês não tiver tantos dias
  const ultimoDiaDoMes = new Date(anoParcela, mesParcela + 1, 0).getDate();
  const diaAjustado = Math.min(diaVencimento, ultimoDiaDoMes);
  
  const dataVencimento = new Date(anoParcela, mesParcela, diaAjustado);
  
  // Ajusta para o próximo dia útil
  return calcularProximoDiaUtil(dataVencimento);
}

// Gera todas as datas de vencimento para um consórcio
export function gerarDatasVencimento(
  dataContratacao: Date,
  diaVencimento: number,
  prazoMeses: number
): Date[] {
  const datas: Date[] = [];
  
  for (let i = 1; i <= prazoMeses; i++) {
    const dataVencimento = calcularDataVencimento(dataContratacao, diaVencimento, i);
    datas.push(dataVencimento);
  }
  
  return datas;
}

// Conta dias úteis em um intervalo de datas
export function contarDiasUteis(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => isDiaUtil(day)).length;
}

// Dias úteis da semana atual
export function getDiasUteisSemanaAtual(): number {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Domingo
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 }); // Sábado
  return contarDiasUteis(weekStart, weekEnd);
}

// Dias úteis do mês atual
export function getDiasUteisMesAtual(): number {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  return contarDiasUteis(monthStart, monthEnd);
}
