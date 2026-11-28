function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate() + days); return r; }
function isWeekend(d: Date) { return d.getDay() === 0 || d.getDay() === 6; }
function format(d: Date, _pattern: string) { return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
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

