/**
 * Cálculos puros da cobrança (A receber). Fonte única para Agenda, Pendências,
 * Inadimplência e Resultados — as telas nunca calculam por conta própria.
 * Datas no formato yyyy-MM-dd; "hoje" é calculado em America/Sao_Paulo.
 */

export const SALDO_ALTO_LIMITE = 10000;

export interface ParcelaCalc {
  id: string;
  titulo_id: string;
  numero: number;
  valor: number;
  valor_pago: number | null;
  status: string; // pendente | pago | atrasado | cancelado
  data_vencimento: string;
  data_pagamento: string | null;
  evento?: string | null;
  cobrador_id?: string | null;
  forma_pagamento?: string | null;
}

export interface TituloCalc {
  id: string;
  status: string;
  payment_method?: string | null;
  cobranca_stage?: string | null;
  cobranca_responsavel_id?: string | null;
  negociacao?: boolean | null;
}

export function hojeSP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

const toDate = (s: string) => new Date(s + 'T00:00:00Z');
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addDias(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Segunda-feira da semana (ISO). */
export function inicioSemana(s: string): string {
  const d = toDate(s);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return fmt(d);
}

export const mesDe = (s: string) => s.slice(0, 7);

export function diasEntre(de: string, ate: string): number {
  return Math.round((toDate(ate).getTime() - toDate(de).getTime()) / 86400000);
}

/** Valor em aberto da parcela (mínimo 0). Paga ou cancelada = 0. */
export function emAberto(p: ParcelaCalc): number {
  if (p.status === 'pago' || p.status === 'cancelado') return 0;
  return Math.max(Number(p.valor || 0) - Number(p.valor_pago || 0), 0);
}

export function recebido(p: ParcelaCalc): number {
  if (p.status === 'cancelado') return 0;
  if (p.status === 'pago') return Number(p.valor_pago ?? p.valor ?? 0);
  return Number(p.valor_pago || 0);
}

export function isAtrasada(p: ParcelaCalc, hoje: string): boolean {
  return emAberto(p) > 0 && p.data_vencimento < hoje;
}

/** Título fora da cobrança regular: judicial, cancelado/reembolsado, quitado ou cartão Hubla (recebido no ato). */
export function tituloForaCobranca(t: TituloCalc): boolean {
  if (t.cobranca_stage === 'judicial') return true;
  if (t.status !== 'aberto') return true;
  return (t.payment_method || '').toLowerCase() === 'credit_card';
}

export interface TotaisSemana { inicio: string; previsto: number; recebido: number; aReceber: number; qtd: number }

/** Série contínua de semanas entre duas datas, semanas sem parcelas ficam com zero. */
export function totaisPorSemana(
  parcelas: ParcelaCalc[],
  inicio: string,
  fim: string,
): TotaisSemana[] {
  const out = new Map<string, TotaisSemana>();
  for (let w = inicioSemana(inicio); w <= fim; w = addDias(w, 7)) {
    out.set(w, { inicio: w, previsto: 0, recebido: 0, aReceber: 0, qtd: 0 });
  }
  for (const p of parcelas) {
    if (p.status === 'cancelado') continue;
    if (p.data_vencimento < inicio || p.data_vencimento > fim) continue;
    const w = out.get(inicioSemana(p.data_vencimento));
    if (!w) continue;
    w.previsto += Number(p.valor || 0);
    w.recebido += recebido(p);
    w.aReceber += emAberto(p);
    w.qtd += 1;
  }
  return Array.from(out.values());
}

/** Pendência: venceu em mês anterior ao corrente e ainda tem valor em aberto. */
export function isPendenciaMesAnterior(p: ParcelaCalc, hoje: string): boolean {
  return emAberto(p) > 0 && mesDe(p.data_vencimento) < mesDe(hoje);
}

export type StatusCliente = 'em_dia' | 'atrasado' | 'negociacao' | 'judicial' | 'quitado' | 'cancelado';

export function statusCliente(t: TituloCalc, parcelas: ParcelaCalc[], hoje: string): StatusCliente {
  if (t.status === 'quitado') return 'quitado';
  if (t.status !== 'aberto') return 'cancelado';
  if (t.cobranca_stage === 'judicial') return 'judicial';
  if (t.negociacao) return 'negociacao';
  if ((t.payment_method || '').toLowerCase() === 'credit_card') return 'em_dia';
  return parcelas.some((p) => isAtrasada(p, hoje)) ? 'atrasado' : 'em_dia';
}

/** Somente dígitos com DDI 55 para links wa.me / tel:. */
export function telefoneDigitos(tel?: string | null): string | null {
  const d = (tel || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`;
}

/** Saldo devedor = valor total − entrada − pagos via cobrança (mínimo 0). */
export function saldoDevedor(valorTotal: number, entrada: number, pagosCobranca: number): number {
  return Math.max(Number(valorTotal || 0) - Number(entrada || 0) - Number(pagosCobranca || 0), 0);
}

/** Visões regulares (Cobranças Regulares, Agenda, Pendências, Inadimplência) nunca mostram jurídico. */
export const visivelNaCobrancaRegular = (t: TituloCalc) => t.cobranca_stage !== 'judicial';
