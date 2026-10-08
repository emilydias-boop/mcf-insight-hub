/** Ticket médio de parceria: só vendas novas A001, A003, A009, R001, R009, com bruto > 0. */
export const TICKET_PARCERIA_TOOLTIP =
  'Só vendas novas de parceria: A001, A003, A009, R001, R009 (sem renovação, sem reembolso, sem parcela de plano anterior)';

const PREFIXOS = ['a001', 'a003', 'a009', 'r001', 'r009'];

export function isProdutoTicketParceria(productName: string | null | undefined): boolean {
  const nome = (productName || '').trim().toLowerCase();
  if (!nome || nome.includes('renova')) return false;
  return PREFIXOS.some((p) => nome.startsWith(p));
}

/** Uma venda já consolidada (uma por vendaKey, bruto/líquido somados). */
export interface VendaTicket {
  productName: string | null | undefined;
  bruto: number;
  liquido: number;
  /** true se algum pagamento da venda tem sale_status 'refunded'. */
  refunded?: boolean;
}

export interface TicketParceria {
  vendas: number;
  brutoTotal: number;
  liquidoTotal: number;
  ticketBruto: number | null;
  ticketLiquido: number | null;
}

/**
 * Só entram no ticket as vendas novas válidas com bruto > 0.
 * Mensalidade de recorrência (ex.: 2/12) e parcela de plano de mês anterior chegam como
 * "venda" com bruto 0: ficam fora do numerador, do denominador e dos totais.
 */
export function calcTicketParceria(vendas: VendaTicket[]): TicketParceria {
  const validas = vendas.filter(
    (v) => isProdutoTicketParceria(v.productName) && !v.refunded && v.liquido >= 0 && v.bruto > 0,
  );
  const brutoTotal = validas.reduce((s, v) => s + v.bruto, 0);
  const liquidoTotal = validas.reduce((s, v) => s + v.liquido, 0);
  return {
    vendas: validas.length,
    brutoTotal,
    liquidoTotal,
    ticketBruto: validas.length > 0 ? brutoTotal / validas.length : null,
    ticketLiquido: validas.length > 0 ? liquidoTotal / validas.length : null,
  };
}
