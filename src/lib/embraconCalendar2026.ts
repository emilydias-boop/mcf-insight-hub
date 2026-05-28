// Calendário oficial Embracon 2026 — período de apuração (qui→qua) e data de pagamento ao parceiro.
// Fonte: CALENDÁRIO OFICIAL 2026 PARCEIRO (PDF).

export interface CalendarWeek {
  n: number;
  ata: string;
  apuracaoInicio: string; // ISO yyyy-mm-dd (inclusivo)
  apuracaoFim: string;    // ISO yyyy-mm-dd (inclusivo)
  dataPagamento: string;  // ISO yyyy-mm-dd
  obs?: string;
}

export const EMBRACON_CALENDAR_2026: CalendarWeek[] = [
  { n: 1, ata: 'dez/25', apuracaoInicio: '2025-12-26', apuracaoFim: '2026-01-01', dataPagamento: '2026-01-09', obs: 'Feriado Ano Novo' },
  { n: 2, ata: 'jan/26', apuracaoInicio: '2026-01-02', apuracaoFim: '2026-01-07', dataPagamento: '2026-01-15' },
  { n: 3, ata: 'jan/26', apuracaoInicio: '2026-01-08', apuracaoFim: '2026-01-14', dataPagamento: '2026-01-22' },
  { n: 4, ata: 'jan/26', apuracaoInicio: '2026-01-15', apuracaoFim: '2026-01-21', dataPagamento: '2026-01-29' },
  { n: 5, ata: 'jan/26', apuracaoInicio: '2026-01-22', apuracaoFim: '2026-01-28', dataPagamento: '2026-02-05' },
  { n: 6, ata: 'fev/26', apuracaoInicio: '2026-01-29', apuracaoFim: '2026-02-04', dataPagamento: '2026-02-12' },
  { n: 7, ata: 'fev/26', apuracaoInicio: '2026-02-05', apuracaoFim: '2026-02-11', dataPagamento: '2026-02-24', obs: 'Carnaval 16/17 e 18/02/2026' },
  { n: 8, ata: 'fev/26', apuracaoInicio: '2026-02-12', apuracaoFim: '2026-02-18', dataPagamento: '2026-02-27', obs: 'Treinamento Interno' },
  { n: 9, ata: 'fev/26', apuracaoInicio: '2026-02-19', apuracaoFim: '2026-02-25', dataPagamento: '2026-03-05' },
  { n: 10, ata: 'mar/26', apuracaoInicio: '2026-02-26', apuracaoFim: '2026-03-04', dataPagamento: '2026-03-12' },
  { n: 11, ata: 'mar/26', apuracaoInicio: '2026-03-05', apuracaoFim: '2026-03-11', dataPagamento: '2026-03-19' },
  { n: 12, ata: 'mar/26', apuracaoInicio: '2026-03-12', apuracaoFim: '2026-03-18', dataPagamento: '2026-03-26' },
  { n: 13, ata: 'mar/26', apuracaoInicio: '2026-03-19', apuracaoFim: '2026-03-25', dataPagamento: '2026-04-02' },
  { n: 14, ata: 'abr/26', apuracaoInicio: '2026-03-26', apuracaoFim: '2026-04-01', dataPagamento: '2026-04-10', obs: 'Feriado Paixão de Cristo - 03/04/2026' },
  { n: 15, ata: 'abr/26', apuracaoInicio: '2026-04-02', apuracaoFim: '2026-04-08', dataPagamento: '2026-04-16' },
  { n: 16, ata: 'abr/26', apuracaoInicio: '2026-04-09', apuracaoFim: '2026-04-15', dataPagamento: '2026-04-23' },
  { n: 17, ata: 'abr/26', apuracaoInicio: '2026-04-16', apuracaoFim: '2026-04-22', dataPagamento: '2026-04-30', obs: 'Feriado Tiradentes - 21/04/2026' },
  { n: 18, ata: 'mai/26', apuracaoInicio: '2026-04-23', apuracaoFim: '2026-04-29', dataPagamento: '2026-05-08', obs: 'Feriado dia do trabalho - 01/05/2026' },
  { n: 19, ata: 'mai/26', apuracaoInicio: '2026-04-30', apuracaoFim: '2026-05-06', dataPagamento: '2026-05-14' },
  { n: 20, ata: 'mai/26', apuracaoInicio: '2026-05-07', apuracaoFim: '2026-05-13', dataPagamento: '2026-05-21' },
  { n: 21, ata: 'mai/26', apuracaoInicio: '2026-05-14', apuracaoFim: '2026-05-20', dataPagamento: '2026-05-28' },
  { n: 22, ata: 'mai/26', apuracaoInicio: '2026-05-21', apuracaoFim: '2026-05-27', dataPagamento: '2026-06-04' },
  { n: 23, ata: 'jun/26', apuracaoInicio: '2026-05-28', apuracaoFim: '2026-06-04', dataPagamento: '2026-06-12', obs: 'Feriado Corpus Christi - 04/06/2026' },
  { n: 24, ata: 'jun/26', apuracaoInicio: '2026-06-05', apuracaoFim: '2026-06-10', dataPagamento: '2026-06-18' },
  { n: 25, ata: 'jun/26', apuracaoInicio: '2026-06-11', apuracaoFim: '2026-06-17', dataPagamento: '2026-06-25' },
  { n: 26, ata: 'jun/26', apuracaoInicio: '2026-06-18', apuracaoFim: '2026-06-24', dataPagamento: '2026-07-02' },
  { n: 27, ata: 'jul/26', apuracaoInicio: '2026-06-25', apuracaoFim: '2026-07-01', dataPagamento: '2026-07-09' },
  { n: 28, ata: 'jul/26', apuracaoInicio: '2026-07-02', apuracaoFim: '2026-07-09', dataPagamento: '2026-07-17', obs: 'Feriado Revolução - 09/07/2026' },
  { n: 29, ata: 'jul/26', apuracaoInicio: '2026-07-10', apuracaoFim: '2026-07-15', dataPagamento: '2026-07-23' },
  { n: 30, ata: 'jul/26', apuracaoInicio: '2026-07-16', apuracaoFim: '2026-07-22', dataPagamento: '2026-07-30' },
  { n: 31, ata: 'jul/26', apuracaoInicio: '2026-07-23', apuracaoFim: '2026-07-29', dataPagamento: '2026-08-06' },
  { n: 32, ata: 'ago/26', apuracaoInicio: '2026-07-30', apuracaoFim: '2026-08-05', dataPagamento: '2026-08-13' },
  { n: 33, ata: 'ago/26', apuracaoInicio: '2026-08-06', apuracaoFim: '2026-08-12', dataPagamento: '2026-08-20' },
  { n: 34, ata: 'ago/26', apuracaoInicio: '2026-08-13', apuracaoFim: '2026-08-19', dataPagamento: '2026-08-27' },
  { n: 35, ata: 'ago/26', apuracaoInicio: '2026-08-20', apuracaoFim: '2026-08-26', dataPagamento: '2026-09-03' },
  { n: 36, ata: 'set/26', apuracaoInicio: '2026-08-27', apuracaoFim: '2026-09-02', dataPagamento: '2026-09-11', obs: 'Independência - 07/09/2026' },
  { n: 37, ata: 'set/26', apuracaoInicio: '2026-09-03', apuracaoFim: '2026-09-09', dataPagamento: '2026-09-17' },
  { n: 38, ata: 'set/26', apuracaoInicio: '2026-09-10', apuracaoFim: '2026-09-16', dataPagamento: '2026-09-24' },
  { n: 39, ata: 'set/26', apuracaoInicio: '2026-09-17', apuracaoFim: '2026-09-23', dataPagamento: '2026-10-01' },
  { n: 40, ata: 'out/26', apuracaoInicio: '2026-09-24', apuracaoFim: '2026-09-30', dataPagamento: '2026-10-08' },
  { n: 41, ata: 'out/26', apuracaoInicio: '2026-10-01', apuracaoFim: '2026-10-07', dataPagamento: '2026-10-16', obs: 'N. Sra. Aparecida - 12/10/2026' },
  { n: 42, ata: 'out/26', apuracaoInicio: '2026-10-08', apuracaoFim: '2026-10-14', dataPagamento: '2026-10-22' },
  { n: 43, ata: 'out/26', apuracaoInicio: '2026-10-15', apuracaoFim: '2026-10-21', dataPagamento: '2026-10-29' },
  { n: 44, ata: 'out/26', apuracaoInicio: '2026-10-22', apuracaoFim: '2026-10-28', dataPagamento: '2026-11-06', obs: 'Finados - 02/11/2026' },
  { n: 45, ata: 'nov/26', apuracaoInicio: '2026-10-29', apuracaoFim: '2026-11-04', dataPagamento: '2026-11-12' },
  { n: 46, ata: 'nov/26', apuracaoInicio: '2026-11-05', apuracaoFim: '2026-11-11', dataPagamento: '2026-11-19' },
  { n: 47, ata: 'nov/26', apuracaoInicio: '2026-11-12', apuracaoFim: '2026-11-18', dataPagamento: '2026-11-27', obs: 'Consciência Negra - 20/11/2026' },
  { n: 48, ata: 'nov/26', apuracaoInicio: '2026-11-19', apuracaoFim: '2026-11-25', dataPagamento: '2026-12-03' },
  { n: 49, ata: 'dez/26', apuracaoInicio: '2026-11-26', apuracaoFim: '2026-12-02', dataPagamento: '2026-12-10' },
  { n: 50, ata: 'dez/26', apuracaoInicio: '2026-12-03', apuracaoFim: '2026-12-09', dataPagamento: '2026-12-17' },
  { n: 51, ata: 'dez/26', apuracaoInicio: '2026-12-10', apuracaoFim: '2026-12-16', dataPagamento: '2026-12-24' },
  { n: 52, ata: 'dez/26', apuracaoInicio: '2026-12-17', apuracaoFim: '2026-12-22', dataPagamento: '2027-01-05', obs: 'Natal - 25/12/2026' },
  { n: 53, ata: 'jan/27', apuracaoInicio: '2026-12-23', apuracaoFim: '2027-01-06', dataPagamento: '2027-01-14', obs: 'Ano Novo - 01/01/2027' },
];

/** Encontra a semana de apuração que contém a data informada (ISO yyyy-mm-dd). */
export function findCalendarWeek(isoDate: string): CalendarWeek | undefined {
  return EMBRACON_CALENDAR_2026.find(
    (w) => isoDate >= w.apuracaoInicio && isoDate <= w.apuracaoFim
  );
}

/** Faixa total coberta pelo calendário 2026 (para filtros de DB). */
export const CALENDAR_RANGE = {
  start: EMBRACON_CALENDAR_2026[0].apuracaoInicio,
  end: EMBRACON_CALENDAR_2026[EMBRACON_CALENDAR_2026.length - 1].apuracaoFim,
};
