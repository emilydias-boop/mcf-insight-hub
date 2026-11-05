export const TIPOS_DOSSIE = { one_on_one: 'One on One', feedback: 'Feedback', yellow_flag: 'Yellow Flag', red_flag: 'Red Flag', pdi: 'PDI', adendo: 'Adendo' };
export type TipoDossie = keyof typeof TIPOS_DOSSIE;
export function registroEditavel(criadoEm: string, agora: number) {
  return agora < Date.parse(criadoEm) + 24 * 60 * 60 * 1000;
}
export function resumoDossie(registros: { tipo: string; ocorrido_em: string; status: string }[], meses: number, agora = new Date()) {
  const corte = new Date(agora); corte.setUTCMonth(corte.getUTCMonth() - meses);
  const recentes = registros.filter(r => Date.parse(r.ocorrido_em) >= corte.getTime() && Date.parse(r.ocorrido_em) <= agora.getTime());
  return {
    one_on_one: recentes.filter(r => r.tipo === 'one_on_one').length,
    feedback: recentes.filter(r => r.tipo === 'feedback').length,
    yellow_flag: recentes.filter(r => r.tipo === 'yellow_flag').length,
    red_flag: recentes.filter(r => r.tipo === 'red_flag').length,
    flags_abertas: registros.filter(r => ['yellow_flag', 'red_flag'].includes(r.tipo) && r.status === 'aberta').length,
    ultima_one_on_one: registros.filter(r => r.tipo === 'one_on_one').map(r => r.ocorrido_em).sort().at(-1) ?? null,
  };
}